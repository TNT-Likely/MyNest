package main

import (
	"context"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/matrix/mynest/backend/downloader"
	"github.com/matrix/mynest/backend/handler"
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

	pluginManager := plugin.NewManager(db)
	pluginRunner := plugin.NewPluginRunner(db)
	pluginService := service.NewPluginService(pluginManager, pluginRunner)
	systemConfigService := service.NewSystemConfigService(db)

	// 启动插件健康检查器
	pluginManager.StartHealthChecker()

	taskSyncService := service.NewTaskSyncService(db, aria2Client)
	taskSyncService.Start()
	defer taskSyncService.Stop()

	if err := pluginRunner.StartEnabledPlugins(); err != nil {
		log.Printf("Failed to start enabled plugins: %v", err)
	}
	defer pluginRunner.StopAll()

	logsService := service.NewLogsService(db)
	downloadService := service.NewDownloadService(db, aria2Client)

	// 添加一些测试日志
	ctx := context.Background()
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
		api.GET("/plugins", pluginHandler.ListPlugins)
		api.POST("/plugins/:name/enable", pluginHandler.EnablePlugin)
		api.POST("/plugins/:name/disable", pluginHandler.DisablePlugin)
		api.POST("/plugins/:name/start", pluginHandler.StartPlugin)
		api.POST("/plugins/:name/stop", pluginHandler.StopPlugin)
		api.GET("/plugins/:name/logs", pluginHandler.GetPluginLogs)

		api.POST("/download", downloadHandler.SubmitDownload)
		api.GET("/tasks", downloadHandler.ListTasks)
		api.GET("/tasks/:id", downloadHandler.GetTask)
		api.GET("/tasks/:id/progress", taskProgressHandler.GetProgress)
		api.POST("/tasks/:id/retry", downloadHandler.RetryTask)
		api.DELETE("/tasks/:id", downloadHandler.DeleteTask)
		api.POST("/tasks/:id/pause", downloadHandler.PauseTask)
		api.DELETE("/tasks/failed", downloadHandler.ClearFailedTasks)

		api.GET("/downloader/status", downloadHandler.CheckDownloaderStatus)

		api.GET("/system/configs", systemConfigHandler.GetAllConfigs)
		api.POST("/system/configs", systemConfigHandler.UpdateConfig)

		api.GET("/system/logs", logsHandler.GetLogs)
		api.DELETE("/system/logs", logsHandler.ClearLogs)
		api.GET("/system/logs/stats", logsHandler.GetLogStats)
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