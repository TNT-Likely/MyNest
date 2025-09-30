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
	FilePath    string     `gorm:"type:text" json:"file_path,omitempty"`
	Status      string     `gorm:"default:'pending'" json:"status"`
	PluginName  string     `json:"plugin_name"`
	Category    string     `json:"category"`
	GID         string     `json:"gid"`
	ErrorMsg    string     `gorm:"type:text" json:"error_msg,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type APIToken struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Token       string    `gorm:"uniqueIndex;not null" json:"token"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	Enabled     bool      `gorm:"default:true" json:"enabled"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string    `gorm:"not null" json:"-"`
	IsAdmin      bool      `gorm:"default:true" json:"is_admin"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

