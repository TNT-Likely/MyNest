package model

import (
	"time"

	"gorm.io/datatypes"
)

type SystemConfig struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Key       string         `gorm:"uniqueIndex;not null" json:"key"`
	Value     string         `gorm:"type:text" json:"value"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type Plugin struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"uniqueIndex;not null" json:"name"`
	Version   string         `json:"version"`
	Enabled   bool           `gorm:"default:false" json:"enabled"`
	Config    datatypes.JSON `gorm:"type:jsonb" json:"config"`
	Endpoint  string         `json:"endpoint"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type DownloadTask struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	URL         string     `gorm:"not null;type:text" json:"url"`
	Filename    string     `json:"filename"`
	Status      string     `gorm:"default:'pending'" json:"status"`
	PluginName  string     `json:"plugin_name"`
	Category    string     `json:"category"`
	GID         string     `json:"gid"`
	ErrorMsg    string     `gorm:"type:text" json:"error_msg,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type SystemLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Level     string    `gorm:"not null;index" json:"level"`     // ERROR, INFO, DEBUG, WARN
	Category  string    `gorm:"not null;index" json:"category"`  // download, plugin, system
	Message   string    `gorm:"not null;type:text" json:"message"`
	Details   string    `gorm:"type:text" json:"details,omitempty"`
	Source    string    `gorm:"index" json:"source,omitempty"`   // 来源组件
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}