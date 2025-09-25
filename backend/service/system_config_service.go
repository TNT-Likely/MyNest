package service

import (
	"context"

	"github.com/matrix/mynest/backend/model"
	"gorm.io/gorm"
)

type SystemConfigService struct {
	db *gorm.DB
}

func NewSystemConfigService(db *gorm.DB) *SystemConfigService {
	return &SystemConfigService{db: db}
}

func (s *SystemConfigService) GetConfig(ctx context.Context, key string) (string, error) {
	var config model.SystemConfig
	if err := s.db.Where("key = ?", key).First(&config).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", err
	}
	return config.Value, nil
}

func (s *SystemConfigService) SetConfig(ctx context.Context, key, value string) error {
	config := model.SystemConfig{
		Key:   key,
		Value: value,
	}

	return s.db.Where("key = ?", key).Assign(config).FirstOrCreate(&config).Error
}

func (s *SystemConfigService) GetAllConfigs(ctx context.Context) (map[string]string, error) {
	var configs []model.SystemConfig
	if err := s.db.Find(&configs).Error; err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, config := range configs {
		result[config.Key] = config.Value
	}

	return result, nil
}