package main

import (
	"context"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/matrix/mynest/backend/downloader"
	"github.com/matrix/mynest/backend/handler"
	"github.com/matrix/mynest/backend/middleware"
	"github.com/matrix/mynest/backend/model"
	"github.com/matrix/mynest/backend/plugin"
	"github.com/matrix/mynest/backend/service"
	"github.com/spf13/viper"
	"gorm.io/gorm"
)

func main() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./backend")
	viper.AddConfigPath(".")

	if err := viper.ReadInConfig(); err != nil {
		log.Fatalf("Error reading config file: %v", err)
	}

	dbConfig := model.DBConfig{
		Host:     viper.GetString("database.host"),
		Port:     viper.GetInt("database.port"),
		User:     viper.GetString("database.user"),
		Password: viper.GetString("database.password"),
		DBName:   viper.GetString("database.dbname"),
		SSLMode:  viper.GetString("database.sslmode"),
	}

	db, err := model.InitDB(dbConfig)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	aria2Client, err := downloader.NewAria2Client(
		viper.GetString("aria2.rpc_url"),
		viper.GetString("aria2.rpc_secret"),
	)
	if err != nil {
		log.Fatalf("Failed to initialize aria2 client: %v", err)
	}

	// JWT密钥配置
	jwtSecret := viper.GetString("auth.jwt_secret")
	if jwtSecret == "" {
		jwtSecret = "mynest-default-secret-change-in-production"
		log.Printf("WARNING: Using default JWT secret, please set auth.jwt_secret in config")
	}

	// 创建认证服务并初始化默认用户（在任何其他启动逻辑之前）
	authService := service.NewAuthService(db, jwtSecret)

	// 初始化默认用户
	ctx := context.Background()
	defaultPassword := viper.GetString("auth.default_password")
	password, isNewUser, err := authService.InitializeDefaultUser(ctx, defaultPassword)
	var displayPassword string
	if err != nil {
		log.Printf("Failed to initialize default user: %v", err)
	} else if password != "" {
		displayPassword = password
		// 根据是否为新用户显示不同的消息
		if isNewUser {
			log.Printf("\n" +
				"=================================================================\n" +
				"  🔐 默认管理员账号已创建\n" +
				"  用户名: admin\n" +
				"  密码: %s\n" +
				"  ⚠️  请立即登录并修改密码！\n" +
				"=================================================================\n",
				password)
		} else {
			// 用户已存在但有配置的密码
			log.Printf("\n" +
				"=================================================================\n" +
				"  🔐 管理员登录信息\n" +
				"  用户名: admin\n" +
				"  密码: %s (来自配置文件)\n" +
				"=================================================================\n",
				password)
		}
	} else {
		// 用户已存在且没有配置密码
		log.Printf("\n" +
			"=================================================================\n" +
			"  ℹ️  管理员账号已存在\n" +
			"  用户名: admin\n" +
			"  如需重置密码，请运行: ./scripts/reset-password.sh\n" +
			"  或在配置文件中设置 auth.default_password\n" +
			"=================================================================\n")
	}

	pluginManager := plugin.NewManager(db)
	pluginRunner := plugin.NewPluginRunner(db)
	pluginService := service.NewPluginService(pluginManager, pluginRunner)
	systemConfigService := service.NewSystemConfigService(db)
	tokenService := service.NewTokenService(db)
	authMiddleware := middleware.NewAuthMiddleware(db, authService)

	// 初始化系统配置（从环境变量/配置文件）
	initializeSystemConfig(ctx, systemConfigService)
	// 迁移旧配置
	migrateOldConfigs(ctx, systemConfigService)

	// 启动插件健康检查器
	pluginManager.StartHealthChecker()

	taskSyncService := service.NewTaskSyncService(db, aria2Client)
	taskSyncService.Start()
	defer taskSyncService.Stop()

	if err := pluginRunner.StartEnabledPlugins(); err != nil {
		log.Printf("Failed to start enabled plugins: %v", err)
	}
	defer pluginRunner.StopAll()

	// 使用项目根目录下的 logs 目录
	logsService := service.NewLogsService("./logs")
	downloadService := service.NewDownloadService(db, aria2Client)

	// 添加一些测试日志
	logsService.AddLog(ctx, "INFO", "system", "MyNest 系统启动", "Core service started successfully", "Main")
	logsService.AddLog(ctx, "DEBUG", "system", "数据库连接成功", "Connected to PostgreSQL database", "Database")
	logsService.AddLog(ctx, "INFO", "plugin", "插件管理器初始化完成", "", "PluginManager")

	// 手动注册 telegram-bot 插件
	telegramPlugin := &model.Plugin{
		Name:     "telegram-bot",
		Version:  "1.0.0",
		Enabled:  false,
		Config:   nil,
		Endpoint: "telegram-bot:50051", // gRPC服务端点
	}

	var existingPlugin model.Plugin
	result := db.Where("name = ?", "telegram-bot").First(&existingPlugin)
	if result.Error == gorm.ErrRecordNotFound {
		// 插件不存在，创建新插件
		if err := db.Create(telegramPlugin).Error; err != nil {
			log.Printf("Failed to register telegram-bot plugin: %v", err)
		} else {
			log.Printf("Successfully registered telegram-bot plugin")
			logsService.AddLog(ctx, "INFO", "plugin", "注册 Telegram Bot 插件", "Plugin registered in database", "PluginManager")
		}
	} else if result.Error != nil {
		log.Printf("Failed to check telegram-bot plugin: %v", result.Error)
	} else {
		log.Printf("Telegram-bot plugin already exists")
	}

	downloadHandler := handler.NewDownloadHandler(downloadService)
	pluginHandler := handler.NewPluginHandler(pluginService)
	systemConfigHandler := handler.NewSystemConfigHandler(systemConfigService)
	logsHandler := handler.NewLogsHandler(logsService)
	taskProgressHandler := handler.NewTaskProgressHandler(downloadService)
	tokenHandler := handler.NewTokenHandler(tokenService)
	authHandler := handler.NewAuthHandler(authService)

	// 如果有密码，记录到日志系统
	if displayPassword != "" {
		if isNewUser {
			logsService.AddLog(ctx, "WARN", "security", "默认管理员账号已创建", fmt.Sprintf("Username: admin, Password: %s", displayPassword), "Auth")
		} else {
			logsService.AddLog(ctx, "INFO", "security", "管理员密码提示", fmt.Sprintf("Username: admin, Password: %s (from config)", displayPassword), "Auth")
		}
	}

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := r.Group("/api/v1")
	{
		// 登录接口（不需要认证）
		api.POST("/auth/login", authHandler.Login)
	}

	// 需要用户认证的API（管理界面）
	apiAuth := r.Group("/api/v1")
	apiAuth.Use(authMiddleware.RequireAuth())
	{
		// 用户信息
		apiAuth.GET("/auth/me", authHandler.GetCurrentUser)
		apiAuth.POST("/auth/change-password", authHandler.ChangePassword)

		// Token 管理 API
		apiAuth.GET("/tokens", tokenHandler.ListTokens)
		apiAuth.POST("/tokens", tokenHandler.CreateToken)
		apiAuth.GET("/tokens/:id", tokenHandler.GetToken)
		apiAuth.PUT("/tokens/:id", tokenHandler.UpdateToken)
		apiAuth.DELETE("/tokens/:id", tokenHandler.DeleteToken)

		// 插件管理
		apiAuth.GET("/plugins", pluginHandler.ListPlugins)
		apiAuth.POST("/plugins/:name/enable", pluginHandler.EnablePlugin)
		apiAuth.POST("/plugins/:name/disable", pluginHandler.DisablePlugin)
		apiAuth.POST("/plugins/:name/start", pluginHandler.StartPlugin)
		apiAuth.POST("/plugins/:name/stop", pluginHandler.StopPlugin)
		apiAuth.POST("/plugins/:name/restart", pluginHandler.RestartPlugin)
		apiAuth.GET("/plugins/:name/logs", pluginHandler.GetPluginLogs)

		// 任务管理（只读操作）
		apiAuth.GET("/tasks", downloadHandler.ListTasks)
		apiAuth.GET("/tasks/:id", downloadHandler.GetTask)
		apiAuth.GET("/tasks/:id/progress", taskProgressHandler.GetProgress)
		apiAuth.POST("/tasks/:id/retry", downloadHandler.RetryTask)
		apiAuth.DELETE("/tasks/:id", downloadHandler.DeleteTask)
		apiAuth.POST("/tasks/:id/pause", downloadHandler.PauseTask)
		apiAuth.DELETE("/tasks/failed", downloadHandler.ClearFailedTasks)

		apiAuth.GET("/downloader/status", downloadHandler.CheckDownloaderStatus)

		// 系统配置
		apiAuth.GET("/system/configs", systemConfigHandler.GetAllConfigs)
		apiAuth.POST("/system/configs", systemConfigHandler.UpdateConfig)

		apiAuth.GET("/system/logs", logsHandler.GetLogs)
		apiAuth.DELETE("/system/logs", logsHandler.ClearLogs)
		apiAuth.GET("/system/logs/stats", logsHandler.GetLogStats)
	}

	// 需要用户认证或API Token认证的接口（支持管理界面和扩展插件）
	apiAuthOrToken := r.Group("/api/v1")
	apiAuthOrToken.Use(authMiddleware.RequireAuthOrToken())
	{
		// 提交下载任务（支持用户和插件）
		apiAuthOrToken.POST("/download", downloadHandler.SubmitDownload)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"name":   "MyNest",
		})
	})

	port := viper.GetInt("server.port")
	if port == 0 {
		port = 8080
	}

	addr := fmt.Sprintf(":%d", port)
	log.Printf("MyNest Core starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// initializeSystemConfig 初始化系统配置（仅在配置不存在时设置默认值）
func initializeSystemConfig(ctx context.Context, svc *service.SystemConfigService) {
	configs := map[string]string{
		"aria2_rpc_url":           viper.GetString("aria2.rpc_url"),
		"aria2_rpc_secret":        viper.GetString("aria2.rpc_secret"),
		"aria2_download_dir":      viper.GetString("aria2.download_dir"),
		"download_path_template":  "{plugin}/{date}/{filename}",
		"manual_download_path":    "manual/{filename}",
		"chrome_extension_path":   "chrome/{filename}",
	}

	for key, defaultValue := range configs {
		// 检查配置是否已存在
		existingValue, err := svc.GetConfig(ctx, key)
		if err != nil || existingValue == "" {
			// 配置不存在，设置默认值
			if defaultValue != "" {
				if err := svc.SetConfig(ctx, key, defaultValue); err != nil {
					log.Printf("Failed to initialize config %s: %v", key, err)
				} else {
					log.Printf("Initialized config: %s = %s", key, defaultValue)
				}
			}
		}
	}
}

// migrateOldConfigs 迁移旧的配置值到新的默认值
func migrateOldConfigs(ctx context.Context, svc *service.SystemConfigService) {
	// 迁移 manual_download_path: {filename} -> manual/{filename}
	manualPath, err := svc.GetConfig(ctx, "manual_download_path")
	if err == nil && manualPath == "{filename}" {
		if err := svc.SetConfig(ctx, "manual_download_path", "manual/{filename}"); err != nil {
			log.Printf("Failed to migrate manual_download_path: %v", err)
		} else {
			log.Printf("Migrated manual_download_path: {filename} -> manual/{filename}")
		}
	}
}