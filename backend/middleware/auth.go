package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/matrix/mynest/backend/model"
	"github.com/matrix/mynest/backend/service"
	"gorm.io/gorm"
)

type AuthMiddleware struct {
	db          *gorm.DB
	authService *service.AuthService
}

func NewAuthMiddleware(db *gorm.DB, authService *service.AuthService) *AuthMiddleware {
	return &AuthMiddleware{
		db:          db,
		authService: authService,
	}
}

// RequireToken 验证API Token（用于扩展插件）
func (m *AuthMiddleware) RequireToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 Authorization header 获取 token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "缺少认证令牌",
			})
			c.Abort()
			return
		}

		// 支持 "Bearer <token>" 格式
		token := authHeader
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// 验证 token
		var apiToken model.APIToken
		result := m.db.Where("token = ? AND enabled = ?", token, true).First(&apiToken)
		if result.Error != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "无效的认证令牌",
			})
			c.Abort()
			return
		}

		// 更新最后使用时间
		now := time.Now()
		m.db.Model(&apiToken).Update("last_used_at", now)

		// 将 token 信息存入 context
		c.Set("api_token", &apiToken)
		c.Next()
	}
}

// RequireAuth 验证用户JWT Token（用于管理界面）
func (m *AuthMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 Authorization header 获取 token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "未登录",
			})
			c.Abort()
			return
		}

		// 支持 "Bearer <token>" 格式
		token := authHeader
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// 验证 JWT token
		claims, err := m.authService.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "登录已过期，请重新登录",
			})
			c.Abort()
			return
		}

		// 将用户信息存入 context
		if userID, ok := (*claims)["user_id"].(float64); ok {
			c.Set("user_id", uint(userID))
		}
		if username, ok := (*claims)["username"].(string); ok {
			c.Set("username", username)
		}
		if isAdmin, ok := (*claims)["is_admin"].(bool); ok {
			c.Set("is_admin", isAdmin)
		}

		c.Next()
	}
}

// RequireAuthOrToken 验证用户JWT Token或API Token（支持管理界面和扩展插件）
func (m *AuthMiddleware) RequireAuthOrToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 Authorization header 获取 token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error":   "缺少认证信息",
			})
			c.Abort()
			return
		}

		// 支持 "Bearer <token>" 格式
		token := authHeader
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// 首先尝试验证 JWT token（用户登录）
		claims, err := m.authService.ValidateToken(token)
		if err == nil {
			// JWT 验证成功，将用户信息存入 context
			if userID, ok := (*claims)["user_id"].(float64); ok {
				c.Set("user_id", uint(userID))
			}
			if username, ok := (*claims)["username"].(string); ok {
				c.Set("username", username)
			}
			if isAdmin, ok := (*claims)["is_admin"].(bool); ok {
				c.Set("is_admin", isAdmin)
			}
			c.Next()
			return
		}

		// JWT 验证失败，尝试验证 API Token
		var apiToken model.APIToken
		result := m.db.Where("token = ? AND enabled = ?", token, true).First(&apiToken)
		if result.Error == nil {
			// API Token 验证成功
			// 更新最后使用时间
			now := time.Now()
			m.db.Model(&apiToken).Update("last_used_at", now)

			// 将 token 信息存入 context
			c.Set("api_token", &apiToken)
			c.Next()
			return
		}

		// 两种验证都失败
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "无效的认证信息",
		})
		c.Abort()
	}
}