package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/matrix/mynest/backend/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db        *gorm.DB
	jwtSecret []byte
}

func NewAuthService(db *gorm.DB, jwtSecret string) *AuthService {
	return &AuthService{
		db:        db,
		jwtSecret: []byte(jwtSecret),
	}
}

// GenerateRandomPassword 生成随机密码
func (s *AuthService) GenerateRandomPassword(length int) (string, error) {
	if length < 8 {
		length = 8
	}
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes)[:length], nil
}

// HashPassword 哈希密码
func (s *AuthService) HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// CheckPassword 验证密码
func (s *AuthService) CheckPassword(hashedPassword, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}

// InitializeDefaultUser 初始化默认用户
// 返回：(生成的密码, 是否新创建, error)
func (s *AuthService) InitializeDefaultUser(ctx context.Context, configPassword string) (string, bool, error) {
	// 检查是否已存在用户
	var count int64
	if err := s.db.Model(&model.User{}).Count(&count).Error; err != nil {
		return "", false, err
	}

	if count > 0 {
		// 用户已存在，返回配置的密码（如果有）
		if configPassword != "" {
			return configPassword, false, nil
		}
		// 没有配置密码，返回空
		return "", false, nil
	}

	// 确定使用的密码
	password := configPassword
	generatedPassword := ""

	if password == "" {
		// 生成随机密码
		var err error
		password, err = s.GenerateRandomPassword(16)
		if err != nil {
			return "", false, fmt.Errorf("failed to generate password: %w", err)
		}
		generatedPassword = password
	}

	// 哈希密码
	hashedPassword, err := s.HashPassword(password)
	if err != nil {
		return "", false, fmt.Errorf("failed to hash password: %w", err)
	}

	// 创建默认管理员用户
	user := &model.User{
		Username:     "admin",
		PasswordHash: hashedPassword,
		IsAdmin:      true,
	}

	if err := s.db.Create(user).Error; err != nil {
		return "", false, fmt.Errorf("failed to create user: %w", err)
	}

	// 返回密码（生成的或配置的）
	if generatedPassword != "" {
		return generatedPassword, true, nil
	}
	return password, true, nil
}

// Login 用户登录
func (s *AuthService) Login(ctx context.Context, username, password string) (string, error) {
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("用户名或密码错误")
		}
		return "", err
	}

	// 验证密码
	if !s.CheckPassword(user.PasswordHash, password) {
		return "", errors.New("用户名或密码错误")
	}

	// 生成 JWT token
	token, err := s.GenerateToken(&user)
	if err != nil {
		return "", fmt.Errorf("failed to generate token: %w", err)
	}

	return token, nil
}

// GenerateToken 生成 JWT token
func (s *AuthService) GenerateToken(user *model.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"is_admin": user.IsAdmin,
		"exp":      time.Now().Add(24 * 7 * time.Hour).Unix(), // 7天过期
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// ValidateToken 验证 JWT token
func (s *AuthService) ValidateToken(tokenString string) (*jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return &claims, nil
	}

	return nil, errors.New("invalid token")
}

// ChangePassword 修改密码
func (s *AuthService) ChangePassword(ctx context.Context, userID uint, oldPassword, newPassword string) error {
	var user model.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return err
	}

	// 验证旧密码
	if !s.CheckPassword(user.PasswordHash, oldPassword) {
		return errors.New("旧密码错误")
	}

	// 哈希新密码
	hashedPassword, err := s.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	// 更新密码
	return s.db.Model(&user).Update("password_hash", hashedPassword).Error
}

// GetUserByID 根据ID获取用户
func (s *AuthService) GetUserByID(ctx context.Context, userID uint) (*model.User, error) {
	var user model.User
	if err := s.db.First(&user, userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}