package main

import (
	"context"
	"log"
	"net"

	"google.golang.org/grpc"
)

// PluginServer gRPC 插件服务器
// 实现插件系统的 gRPC 接口，负责插件的生命周期管理
type PluginServer struct {
	// bot 当前运行的 Telegram Bot 实例
	bot *TelegramBot

	// grpcServer gRPC 服务器实例
	grpcServer *grpc.Server
}

// NewPluginServer 创建新的插件服务器
// 返回: PluginServer 实例指针
func NewPluginServer() *PluginServer {
	return &PluginServer{}
}

// Register 注册插件
// 这个方法在插件首次注册到核心系统时被调用
// 参数:
//   - ctx: 上下文
//   - req: 注册请求参数（通常包含插件元数据）
// 返回: 注册结果和可能的错误
func (s *PluginServer) Register(ctx context.Context, req map[string]interface{}) (map[string]interface{}, error) {
	log.Printf("Telegram Bot plugin registered successfully")
	return map[string]interface{}{
		"success": true,
		"message": "Telegram Bot plugin registered successfully",
	}, nil
}

// Start 启动插件
// 这个方法在用户启用插件时被调用，负责初始化和启动 Telegram Bot
// 参数:
//   - ctx: 上下文
//   - configMap: 插件配置参数映射
// 返回: 启动结果和可能的错误
func (s *PluginServer) Start(ctx context.Context, configMap map[string]interface{}) (map[string]interface{}, error) {
	log.Printf("Starting Telegram Bot plugin...")

	// 从配置映射中提取配置并构建 TelegramBotConfig
	config := TelegramBotConfig{
		// 默认启用所有解析功能
		ParseForwardedMsg:     true,
		ParseForwardedComment: true,
		DownloadMedia:         true, // 默认启用媒体下载
	}

	// 提取 Bot Token（必需）
	if botToken, ok := configMap["bot_token"].(string); ok {
		config.BotToken = botToken
	} else {
		return map[string]interface{}{
			"success": false,
			"message": "bot_token is required",
		}, nil
	}

	// 提取核心 API 地址
	if coreAPI, ok := configMap["core_api_url"].(string); ok {
		config.CoreAPI = coreAPI
	} else {
		// 使用默认值（适用于 Docker 环境）
		config.CoreAPI = "http://mynest:8080/api/v1"
	}

	// 提取允许的用户 ID 列表
	if allowedIDs, ok := configMap["allowed_user_ids"].(string); ok {
		config.AllowedIDs = parseAllowedUserIDs(allowedIDs)
	}

	// 提取转发消息解析配置
	if parseForwarded, ok := configMap["parse_forwarded_msg"].(string); ok {
		config.ParseForwardedMsg = parseForwarded != "false"
	}

	// 提取转发评论解析配置
	if parseComment, ok := configMap["parse_forwarded_comment"].(string); ok {
		config.ParseForwardedComment = parseComment != "false"
	}

	// 提取媒体下载配置
	if downloadMedia, ok := configMap["download_media"].(string); ok {
		config.DownloadMedia = downloadMedia != "false"  // 默认开启，只有明确设置为 false 时才关闭
	}

	// 验证必需配置
	if config.BotToken == "" {
		return map[string]interface{}{
			"success": false,
			"message": "bot_token is required",
		}, nil
	}

	// 创建 Telegram Bot 实例
	bot, err := NewTelegramBot(config)
	if err != nil {
		log.Printf("Failed to create Telegram Bot: %v", err)
		return map[string]interface{}{
			"success": false,
			"message": err.Error(),
		}, nil
	}

	// 保存 bot 实例
	s.bot = bot

	// 异步启动机器人
	go func() {
		if err := s.bot.Start(); err != nil {
			log.Printf("Telegram bot failed: %v", err)
		}
	}()

	log.Printf("Telegram Bot started successfully")
	return map[string]interface{}{
		"success": true,
		"message": "Telegram Bot started successfully",
	}, nil
}

// Stop 停止插件
// 这个方法在用户禁用插件时被调用，负责优雅关闭 Telegram Bot
// 参数:
//   - ctx: 上下文
// 返回: 停止结果和可能的错误
func (s *PluginServer) Stop(ctx context.Context) (map[string]interface{}, error) {
	log.Printf("Stopping Telegram Bot plugin...")

	// 如果 bot 实例存在，停止它
	if s.bot != nil {
		s.bot.Stop()
		s.bot = nil // 清理引用
	}

	log.Printf("Telegram Bot stopped successfully")
	return map[string]interface{}{
		"success": true,
		"message": "Telegram Bot stopped successfully",
	}, nil
}

// Restart 重启插件
// 这个方法提供插件重启功能，用于配置更新后的重启场景
// 参数:
//   - ctx: 上下文
//   - configMap: 新的配置参数映射
// 返回: 重启结果和可能的错误
func (s *PluginServer) Restart(ctx context.Context, configMap map[string]interface{}) (map[string]interface{}, error) {
	log.Printf("Restarting Telegram Bot plugin...")

	// 先停止当前实例
	if _, err := s.Stop(ctx); err != nil {
		return map[string]interface{}{
			"success": false,
			"message": "Failed to stop current instance: " + err.Error(),
		}, nil
	}

	// 然后用新配置启动
	return s.Start(ctx, configMap)
}

// GetConfigSchema 获取插件配置模式
// 这个方法返回插件的配置字段定义，用于前端动态生成配置表单
// 参数:
//   - ctx: 上下文
// 返回: 配置模式和可能的错误
func (s *PluginServer) GetConfigSchema(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"fields": []map[string]interface{}{
			{
				"key":      "bot_token",
				"label":    "Bot Token",
				"type":     "password",
				"required": true,
				"help":     "从 @BotFather 获取的 Telegram Bot Token",
			},
			{
				"key":      "core_api_url",
				"label":    "Core API URL",
				"type":     "text",
				"required": false,
				"default":  "http://mynest:8080/api/v1",
				"help":     "核心服务的 API 地址，通常不需要修改",
			},
			{
				"key":      "allowed_user_ids",
				"label":    "Allowed User IDs",
				"type":     "text",
				"required": false,
				"help":     "允许使用机器人的用户ID列表，用逗号分隔。留空表示允许所有用户",
				"placeholder": "123456789,987654321",
			},
			{
				"key":      "download_media",
				"label":    "Download Media Files",
				"type":     "checkbox",
				"required": false,
				"default":  true,
				"help":     "是否自动下载转发的媒体文件（图片、视频等）",
			},
		},
	}, nil
}

// StartGRPCServer 启动 gRPC 服务器
// 这个函数启动插件的 gRPC 服务，监听来自核心系统的管理请求
// 参数:
//   - port: 监听端口号
// 返回: 可能的错误
func (s *PluginServer) StartGRPCServer(port string) error {
	// 创建 TCP 监听器
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return err
	}

	// 创建 gRPC 服务器
	s.grpcServer = grpc.NewServer()

	// TODO: 注册实际的 gRPC 服务
	// 这里需要根据插件系统的 proto 定义来注册服务
	// 目前作为占位符实现

	log.Printf("Telegram Bot Plugin gRPC server listening on port %s", port)

	// 启动服务器（这个调用会阻塞）
	return s.grpcServer.Serve(listener)
}

// StopGRPCServer 停止 gRPC 服务器
// 优雅关闭 gRPC 服务器
func (s *PluginServer) StopGRPCServer() {
	if s.grpcServer != nil {
		log.Printf("Stopping gRPC server...")
		s.grpcServer.GracefulStop()
		s.grpcServer = nil
	}
}