package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"google.golang.org/grpc"
)

// Config 配置结构
type Config struct {
	BotToken              string
	CoreAPI               string
	AllowedIDs            []int64
	ParseForwardedMsg     bool
	ParseForwardedComment bool
}

// DownloadRequest 下载请求结构
type DownloadRequest struct {
	URL        string `json:"url"`
	PluginName string `json:"plugin"`
	Category   string `json:"category"`
}

// TelegramBot 机器人实例
type TelegramBot struct {
	bot    *tgbotapi.BotAPI
	config Config
	stop   chan bool
}

var urlRegex = regexp.MustCompile(`(https?://[^\s]+|magnet:\?[^\s]+)`)

// NewTelegramBot 创建新的电报机器人实例
func NewTelegramBot(config Config) (*TelegramBot, error) {
	bot, err := tgbotapi.NewBotAPI(config.BotToken)
	if err != nil {
		return nil, err
	}

	bot.Debug = false
	log.Printf("Telegram Bot authorized on account %s", bot.Self.UserName)

	return &TelegramBot{
		bot:    bot,
		config: config,
		stop:   make(chan bool),
	}, nil
}

// Start 启动机器人
func (tb *TelegramBot) Start() error {
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := tb.bot.GetUpdatesChan(u)
	log.Printf("Telegram Bot started, waiting for messages...")

	for {
		select {
		case <-tb.stop:
			tb.bot.StopReceivingUpdates()
			return nil
		case update := <-updates:
			if update.Message == nil {
				continue
			}

			userID := update.Message.From.ID
			log.Printf("Received message from user %d: %s", userID, update.Message.Text)

			if len(tb.config.AllowedIDs) > 0 && !isAllowed(userID, tb.config.AllowedIDs) {
				tb.bot.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "❌ 你没有权限使用此机器人"))
				continue
			}

			var text string
			if tb.config.ParseForwardedMsg && update.Message.ForwardFrom != nil {
				text = update.Message.Text
			} else if tb.config.ParseForwardedComment && update.Message.ReplyToMessage != nil {
				text = update.Message.Text
			} else {
				text = update.Message.Text
			}

			urls := extractURLs(text)
			if len(urls) == 0 {
				tb.bot.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "❌ 未找到有效的下载链接"))
				continue
			}

			for _, url := range urls {
				if err := submitDownload(tb.config.CoreAPI, url); err != nil {
					tb.bot.Send(tgbotapi.NewMessage(update.Message.Chat.ID, fmt.Sprintf("❌ 下载失败: %v", err)))
				} else {
					tb.bot.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "✅ 已添加到下载队列"))
				}
			}
		}
	}
}

// Stop 停止机器人
func (tb *TelegramBot) Stop() {
	close(tb.stop)
}

// 工具函数
func parseAllowedIDs(idsStr string) []int64 {
	if idsStr == "" {
		return nil
	}

	parts := strings.Split(idsStr, ",")
	var ids []int64
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if id, err := strconv.ParseInt(part, 10, 64); err == nil {
			ids = append(ids, id)
		}
	}
	return ids
}

func isAllowed(userID int64, allowedIDs []int64) bool {
	for _, id := range allowedIDs {
		if id == userID {
			return true
		}
	}
	return false
}

func extractURLs(text string) []string {
	return urlRegex.FindAllString(text, -1)
}

func submitDownload(coreAPI, url string) error {
	req := DownloadRequest{
		URL:        url,
		PluginName: "telegram-bot",
		Category:   "telegram",
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return err
	}

	resp, err := http.Post(coreAPI+"/download", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	return nil
}

// gRPC服务相关结构和函数
type PluginServer struct {
	bot *TelegramBot
}

func (s *PluginServer) Register(ctx context.Context, req map[string]interface{}) (map[string]interface{}, error) {
	log.Printf("Plugin registered")
	return map[string]interface{}{
		"success": true,
		"message": "Telegram Bot plugin registered successfully",
	}, nil
}

func (s *PluginServer) Start(ctx context.Context, configMap map[string]interface{}) (map[string]interface{}, error) {
	// 从配置映射中提取配置
	config := Config{
		ParseForwardedMsg:     true,
		ParseForwardedComment: true,
	}

	if botToken, ok := configMap["bot_token"].(string); ok {
		config.BotToken = botToken
	}
	if coreAPI, ok := configMap["core_api_url"].(string); ok {
		config.CoreAPI = coreAPI
	} else {
		config.CoreAPI = "http://mynest:8080/api/v1"
	}
	if allowedIDs, ok := configMap["allowed_user_ids"].(string); ok {
		config.AllowedIDs = parseAllowedIDs(allowedIDs)
	}

	if config.BotToken == "" {
		return map[string]interface{}{
			"success": false,
			"message": "bot_token is required",
		}, nil
	}

	bot, err := NewTelegramBot(config)
	if err != nil {
		return map[string]interface{}{
			"success": false,
			"message": err.Error(),
		}, nil
	}

	s.bot = bot

	// 异步启动机器人
	go func() {
		if err := s.bot.Start(); err != nil {
			log.Printf("Telegram bot failed: %v", err)
		}
	}()

	return map[string]interface{}{
		"success": true,
		"message": "Telegram Bot started successfully",
	}, nil
}

func (s *PluginServer) Stop(ctx context.Context) (map[string]interface{}, error) {
	if s.bot != nil {
		s.bot.Stop()
	}
	return map[string]interface{}{
		"success": true,
		"message": "Telegram Bot stopped successfully",
	}, nil
}

func (s *PluginServer) GetConfigSchema(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"fields": []map[string]interface{}{
			{
				"key":      "bot_token",
				"label":    "Bot Token",
				"type":     "password",
				"required": true,
			},
			{
				"key":      "core_api_url",
				"label":    "Core API URL",
				"type":     "text",
				"required": false,
			},
			{
				"key":      "allowed_user_ids",
				"label":    "Allowed User IDs (comma separated)",
				"type":     "text",
				"required": false,
			},
		},
	}, nil
}

func startGRPCServer() {
	port := os.Getenv("PLUGIN_PORT")
	if port == "" {
		port = "50051"
	}

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	_ = &PluginServer{} // 暂时不使用，为将来的gRPC实现保留

	log.Printf("Telegram Bot Plugin gRPC server listening on :%s", port)
	// 注意：这里应该注册实际的gRPC服务，但为了简化，我们先用HTTP方式
	// 目前只是启动一个空的gRPC服务器作为占位符
	if err := grpcServer.Serve(listener); err != nil {
		log.Fatalf("Failed to serve gRPC: %v", err)
	}
}

func main() {
	// 检查运行模式
	mode := os.Getenv("PLUGIN_MODE")
	if mode == "grpc" {
		// gRPC服务模式
		startGRPCServer()
		return
	}

	// 直接运行模式（向后兼容）
	parseForwarded := os.Getenv("PARSE_FORWARDED_MSG")
	parseComment := os.Getenv("PARSE_FORWARDED_COMMENT")
	config := Config{
		BotToken:              os.Getenv("BOT_TOKEN"),
		CoreAPI:               os.Getenv("CORE_API_URL"),
		AllowedIDs:            parseAllowedIDs(os.Getenv("ALLOWED_USER_IDS")),
		ParseForwardedMsg:     parseForwarded == "" || parseForwarded == "true",
		ParseForwardedComment: parseComment == "" || parseComment == "true",
	}

	if config.BotToken == "" {
		log.Fatal("BOT_TOKEN is required")
	}
	if config.CoreAPI == "" {
		config.CoreAPI = "http://localhost:8080/api/v1"
	}

	bot, err := NewTelegramBot(config)
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("Starting Telegram Bot...")
	if err := bot.Start(); err != nil {
		log.Printf("Bot stopped: %v", err)
	}
}