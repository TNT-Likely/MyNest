package model

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type DBConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

func InitDB(cfg DBConfig) (*gorm.DB, error) {
	var dsn string
	if cfg.Password != "" {
		dsn = fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode)
	} else {
		dsn = fmt.Sprintf("host=%s port=%d user=%s dbname=%s sslmode=%s",
			cfg.Host, cfg.Port, cfg.User, cfg.DBName, cfg.SSLMode)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	if err := db.AutoMigrate(&SystemConfig{}, &Plugin{}, &DownloadTask{}, &SystemLog{}); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}

	return db, nil
}