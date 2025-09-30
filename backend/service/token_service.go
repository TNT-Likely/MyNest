package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/matrix/mynest/backend/model"
	"gorm.io/gorm"
)

type TokenService struct {
	db *gorm.DB
}

func NewTokenService(db *gorm.DB) *TokenService {
	return &TokenService{db: db}
}

// GenerateToken 生成随机token
func (s *TokenService) GenerateToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// CreateToken 创建新的API token
func (s *TokenService) CreateToken(ctx context.Context, name, description string) (*model.APIToken, error) {
	token, err := s.GenerateToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	apiToken := &model.APIToken{
		Name:        name,
		Token:       token,
		Description: description,
		Enabled:     true,
	}

	if err := s.db.Create(apiToken).Error; err != nil {
		return nil, fmt.Errorf("failed to create token: %w", err)
	}

	return apiToken, nil
}

// ListTokens 列出所有token
func (s *TokenService) ListTokens(ctx context.Context) ([]model.APIToken, error) {
	var tokens []model.APIToken
	if err := s.db.Order("created_at DESC").Find(&tokens).Error; err != nil {
		return nil, err
	}
	return tokens, nil
}

// GetToken 获取token详情
func (s *TokenService) GetToken(ctx context.Context, id uint) (*model.APIToken, error) {
	var token model.APIToken
	if err := s.db.First(&token, id).Error; err != nil {
		return nil, err
	}
	return &token, nil
}

// UpdateToken 更新token
func (s *TokenService) UpdateToken(ctx context.Context, id uint, name, description string, enabled bool) error {
	updates := map[string]interface{}{
		"name":        name,
		"description": description,
		"enabled":     enabled,
	}
	return s.db.Model(&model.APIToken{}).Where("id = ?", id).Updates(updates).Error
}

// DeleteToken 删除token
func (s *TokenService) DeleteToken(ctx context.Context, id uint) error {
	return s.db.Delete(&model.APIToken{}, id).Error
}

// ValidateToken 验证token是否有效
func (s *TokenService) ValidateToken(ctx context.Context, token string) (*model.APIToken, error) {
	var apiToken model.APIToken
	if err := s.db.Where("token = ? AND enabled = ?", token, true).First(&apiToken).Error; err != nil {
		return nil, err
	}
	return &apiToken, nil
}