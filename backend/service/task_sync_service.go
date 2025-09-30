package service

import (
	"context"
	"log"
	"time"

	"github.com/matrix/mynest/backend/downloader"
	"github.com/matrix/mynest/backend/model"
	"github.com/matrix/mynest/internal/types"
	"gorm.io/gorm"
)

type TaskSyncService struct {
	db                 *gorm.DB
	downloader         downloader.Downloader
	stopChan           chan struct{}
	aria2Available     bool
	aria2CheckFailures int
}

func NewTaskSyncService(db *gorm.DB, dl downloader.Downloader) *TaskSyncService {
	return &TaskSyncService{
		db:             db,
		downloader:     dl,
		stopChan:       make(chan struct{}),
		aria2Available: true, // 初始假设可用
	}
}

func (s *TaskSyncService) Start() {
	ticker := time.NewTicker(3 * time.Second)
	go func() {
		for {
			select {
			case <-ticker.C:
				s.syncActiveTasks()
			case <-s.stopChan:
				ticker.Stop()
				return
			}
		}
	}()
}

func (s *TaskSyncService) Stop() {
	close(s.stopChan)
}

func (s *TaskSyncService) syncActiveTasks() {
	// 先检查 aria2 是否可用
	ctx := context.Background()
	_, err := s.downloader.GetVersion(ctx)
	if err != nil {
		s.aria2CheckFailures++
		if s.aria2Available {
			log.Printf("⚠️  aria2 服务不可用，连续失败次数: %d", s.aria2CheckFailures)
		}

		// 连续失败3次后，标记运行中的任务为已暂停（避免误判）
		if s.aria2CheckFailures >= 3 && s.aria2Available {
			s.aria2Available = false
			log.Printf("⏸️  aria2 服务已停止，标记运行中任务为已暂停")

			// 只标记 pending 和 downloading 状态的任务，不修改已暂停的任务
			var tasks []*model.DownloadTask
			if err := s.db.Where("status IN ?", []string{
				string(types.TaskStatusPending),
				string(types.TaskStatusDownloading),
			}).Find(&tasks).Error; err != nil {
				log.Printf("Failed to fetch active tasks: %v", err)
				return
			}

			for _, task := range tasks {
				updates := map[string]interface{}{
					"status":    string(types.TaskStatusPaused),
					"error_msg": "aria2 服务已停止，请重启后重试",
				}
				if err := s.db.Model(task).Updates(updates).Error; err != nil {
					log.Printf("Failed to update task %d: %v", task.ID, err)
				}
			}
		}
		return
	}

	// aria2 可用，重置失败计数
	if s.aria2CheckFailures > 0 || !s.aria2Available {
		if !s.aria2Available {
			log.Printf("✅ aria2 服务已恢复")
		}
		s.aria2CheckFailures = 0
		s.aria2Available = true
	}

	var tasks []*model.DownloadTask
	if err := s.db.Where("status IN ?", []string{
		string(types.TaskStatusPending),
		string(types.TaskStatusDownloading),
		string(types.TaskStatusPaused), // 同步暂停的任务，以便检测恢复
	}).Find(&tasks).Error; err != nil {
		log.Printf("Failed to fetch active tasks: %v", err)
		return
	}

	for _, task := range tasks {
		if task.GID == "" {
			continue
		}

		status, err := s.downloader.TellStatus(ctx, task.GID)
		if err != nil {
			log.Printf("Failed to get status for task %d (GID: %s): %v", task.ID, task.GID, err)
			// 单个任务查询失败（任务可能被手动停止、删除或 aria2 重启未恢复会话）
			// 如果任务正在下载或等待中，标记为暂停；如果已经是暂停状态，标记为失败
			updates := map[string]interface{}{}
			if task.Status == string(types.TaskStatusPaused) {
				// 已经是暂停状态，持续查询失败，标记为失败
				updates["status"] = string(types.TaskStatusFailed)
				updates["error_msg"] = "任务已从 aria2 中移除，无法恢复"
			} else {
				// 从活动状态变为查询失败，可能是手动停止，标记为暂停
				updates["status"] = string(types.TaskStatusPaused)
				updates["error_msg"] = "任务已从 aria2 中停止或丢失"
			}
			if err := s.db.Model(task).Updates(updates).Error; err != nil {
				log.Printf("Failed to update task %d status: %v", task.ID, err)
			}
			continue
		}

		// 对于 magnet 链接，如果有后续任务，优先使用后续任务的状态
		actualGID := task.GID
		if len(status.FollowedBy) > 0 {
			followedGID := status.FollowedBy[0]
			followedStatus, err := s.downloader.TellStatus(ctx, followedGID)
			if err == nil {
				// 成功获取后续任务状态，使用它
				status = followedStatus
				actualGID = followedGID
				log.Printf("[TaskSync] 使用后续任务状态: %s -> %s (status: %s)", task.GID, followedGID, status.Status)
			}
		}

		updates := make(map[string]interface{})

		// 如果实际 GID 与数据库中的不同，更新它
		if actualGID != task.GID {
			updates["gid"] = actualGID
		}

		switch status.Status {
		case "active":
			updates["status"] = string(types.TaskStatusDownloading)
			updates["error_msg"] = "" // 清除之前的错误信息
			if len(status.Files) > 0 {
				// 更新文件路径
				updates["file_path"] = status.Files[0].Path
				// 如果还没有设置文件名，也同时设置
				if task.Filename == "" {
					updates["filename"] = status.Files[0].Path
				}
			}
		case "waiting":
			// aria2 队列中等待下载
			updates["status"] = string(types.TaskStatusPending)
			updates["error_msg"] = "" // 清除错误信息
			log.Printf("[TaskSync] ⏳ 任务 %d 等待中: %s", task.ID, task.URL)
		case "paused":
			// 用户手动暂停或系统暂停
			updates["status"] = string(types.TaskStatusPaused)
			updates["error_msg"] = "" // 清除错误信息，暂停不是错误
			log.Printf("[TaskSync] ⏸️  任务 %d 已暂停: %s", task.ID, task.URL)
		case "complete":
			// 检查是否有后续任务（magnet 链接元数据下载完成）
			if len(status.FollowedBy) > 0 {
				// 这是 magnet 链接的元数据任务，切换到实际下载任务
				followedGID := status.FollowedBy[0]
				log.Printf("[TaskSync] 🔄 任务 %d 元数据下载完成，切换到实际下载任务: %s -> %s", task.ID, task.GID, followedGID)

				// 更新 GID 为实际下载任务的 GID
				updates["gid"] = followedGID
				updates["status"] = string(types.TaskStatusDownloading)
				updates["error_msg"] = "" // 清除可能的错误信息

				// 尝试获取实际任务的信息
				followedStatus, err := s.downloader.TellStatus(ctx, followedGID)
				if err == nil && len(followedStatus.Files) > 0 {
					// 更新为实际文件的路径和名称
					updates["file_path"] = followedStatus.Files[0].Path
					if task.Filename == "" || task.Filename == "[METADATA]Big+Buck+Bunny" {
						updates["filename"] = followedStatus.Files[0].Path
					}
				}
			} else {
				// 普通下载任务完成
				updates["status"] = string(types.TaskStatusCompleted)
				now := time.Now()
				updates["completed_at"] = &now
				// 设置文件的完整路径
				if len(status.Files) > 0 {
					updates["file_path"] = status.Files[0].Path
					if task.Filename == "" {
						updates["filename"] = status.Files[0].Path
					}
				}
			}
		case "error", "removed":
			updates["status"] = string(types.TaskStatusFailed)
			if status.ErrorMessage != "" {
				updates["error_msg"] = status.ErrorMessage
				log.Printf("[TaskSync] ❌ 任务 %d 失败: %s, Aria2状态: %s, 错误: %s", task.ID, task.URL, status.Status, status.ErrorMessage)
			} else if status.Status == "error" {
				updates["error_msg"] = "下载失败，未知错误"
				log.Printf("[TaskSync] ❌ 任务 %d 失败: %s, Aria2状态: %s, 原因: 未知错误", task.ID, task.URL, status.Status)
			} else {
				updates["error_msg"] = "任务已被移除"
				log.Printf("[TaskSync] ❌ 任务 %d 被移除: %s, Aria2状态: %s", task.ID, task.URL, status.Status)
			}
		}

		if len(updates) > 0 {
			if err := s.db.Model(task).Updates(updates).Error; err != nil {
				log.Printf("Failed to update task %d: %v", task.ID, err)
			}
		}
	}
}