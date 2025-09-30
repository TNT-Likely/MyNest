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
			// 单个任务查询失败（任务可能被删除或 aria2 重启未恢复会话）
			updates := map[string]interface{}{
				"status":    string(types.TaskStatusPaused),
				"error_msg": "任务已从 aria2 中丢失，请重试",
			}
			if err := s.db.Model(task).Updates(updates).Error; err != nil {
				log.Printf("Failed to update task %d status: %v", task.ID, err)
			}
			continue
		}

		updates := make(map[string]interface{})

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