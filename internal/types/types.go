package types

import "time"

type PluginStatus string

const (
	PluginStatusEnabled  PluginStatus = "enabled"
	PluginStatusDisabled PluginStatus = "disabled"
)

type TaskStatus string

const (
	TaskStatusPending     TaskStatus = "pending"
	TaskStatusDownloading TaskStatus = "downloading"
	TaskStatusCompleted   TaskStatus = "completed"
	TaskStatusFailed      TaskStatus = "failed"
	TaskStatusPaused      TaskStatus = "paused"
)

type DownloadRequest struct {
	URL        string `json:"url" binding:"required"`
	Filename   string `json:"filename"`
	PluginName string `json:"plugin"`
	Category   string `json:"category"`
}

type DownloadTask struct {
	ID          uint       `json:"id"`
	URL         string     `json:"url"`
	Filename    string     `json:"filename"`
	Status      TaskStatus `json:"status"`
	PluginName  string     `json:"plugin_name"`
	Category    string     `json:"category"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type PluginConfig struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
}

type Plugin struct {
	Name    string                 `json:"name"`
	Version string                 `json:"version"`
	Enabled bool                   `json:"enabled"`
	Config  map[string]interface{} `json:"config,omitempty"`
}