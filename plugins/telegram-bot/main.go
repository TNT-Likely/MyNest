package main

import (
	"log"
	"os"
)

// main 程序入口点
// 根据运行模式启动不同的服务：
// - PLUGIN_MODE=grpc: 启动 gRPC 插件服务器
// - 其他: 启动传统的直接运行模式（向后兼容）
func main() {
	// 检查运行模式
	mode := os.Getenv("PLUGIN_MODE")

	if mode == "grpc" {
		// gRPC 插件服务器模式
		startGRPCPluginServer()
	} else {
		// 传统直接运行模式（向后兼容）
		startDirectMode()
	}
}

// startGRPCPluginServer 启动 gRPC 插件服务器
// 这种模式下，插件作为 gRPC 服务运行，接受来自核心系统的管理请求
func startGRPCPluginServer() {
	// 获取监听端口
	port := os.Getenv("PLUGIN_PORT")
	if port == "" {
		port = "50051" // 默认端口
	}

	// 创建插件服务器
	server := NewPluginServer()

	// 启动 gRPC 服务器（阻塞调用）
	log.Printf("Starting Telegram Bot Plugin in gRPC mode on port %s...", port)
	if err := server.StartGRPCServer(port); err != nil {
		log.Fatalf("Failed to start gRPC server: %v", err)
	}
}

// startDirectMode 启动传统直接运行模式
// 这种模式下直接从环境变量读取配置并启动机器人
// 主要用于向后兼容和独立部署场景
func startDirectMode() {
	log.Printf("Starting Telegram Bot in direct mode...")

	// 从环境变量读取配置
	parseForwarded := os.Getenv("PARSE_FORWARDED_MSG")
	parseComment := os.Getenv("PARSE_FORWARDED_COMMENT")
	downloadMedia := os.Getenv("DOWNLOAD_MEDIA")

	// 构建配置
	config := TelegramBotConfig{
		BotToken:              os.Getenv("BOT_TOKEN"),
		CoreAPI:               os.Getenv("CORE_API_URL"),
		AllowedIDs:            parseAllowedUserIDs(os.Getenv("ALLOWED_USER_IDS")),
		ParseForwardedMsg:     parseForwarded == "" || parseForwarded == "true",
		ParseForwardedComment: parseComment == "" || parseComment == "true",
		DownloadMedia:         downloadMedia == "" || downloadMedia == "true", // 默认启用
	}

	// 验证必需配置
	if config.BotToken == "" {
		log.Fatal("BOT_TOKEN is required")
	}

	// 设置默认 API 地址
	if config.CoreAPI == "" {
		config.CoreAPI = "http://localhost:8080/api/v1"
	}

	// 创建并启动机器人
	bot, err := NewTelegramBot(config)
	if err != nil {
		log.Fatalf("Failed to create Telegram Bot: %v", err)
	}

	log.Printf("Starting Telegram Bot...")
	if err := bot.Start(); err != nil {
		log.Printf("Bot stopped: %v", err)
	}
}