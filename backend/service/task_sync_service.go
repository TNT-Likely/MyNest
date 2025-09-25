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
	db         *gorm.DB
	downloader downloader.Downloader
	stopChan   chan struct{}
}

func NewTaskSyncService(db *gorm.DB, dl downloader.Downloader) *TaskSyncService {
	return &TaskSyncService{
		db:         db,
		downloader: dl,
		stopChan:   make(chan struct{}),
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
	var tasks []*model.DownloadTask
	if err := s.db.Where("status IN ?", []string{
		string(types.TaskStatusPending),
		string(types.TaskStatusDownloading),
	}).Find(&tasks).Error; err != nil {
		log.Printf("Failed to fetch active tasks: %v", err)
		return
	}

	for _, task := range tasks {
		if task.GID == "" {
			continue
		}

		status, err := s.downloader.TellStatus(context.Background(), task.GID)
		if err != nil {
			log.Printf("Failed to get status for task %d (GID: %s): %v", task.ID, task.GID, err)
			continue
		}

		updates := make(map[string]interface{})

		switch status.Status {
		case "active":
			updates["status"] = string(types.TaskStatusDownloading)
			if len(status.Files) > 0 {
				// 更新文件路径
				updates["file_path"] = status.Files[0].Path
				// 如果还没有设置文件名，也同时设置
				if task.Filename == "" {
					updates["filename"] = status.Files[0].Path
				}
			}
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