package main

import (
	"log"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// TelegramBot Telegram 机器人主体结构
// 封装了机器人的核心功能，包括消息处理和生命周期管理
type TelegramBot struct {
	// bot Telegram Bot API 实例
	bot *tgbotapi.BotAPI

	// config 机器人配置
	config TelegramBotConfig

	// handler 消息处理器
	handler *MessageHandler

	// stop 停止信号通道
	stop chan bool

	// downloadClient 下载客户端
	downloadClient *DownloadClient
}

// NewTelegramBot 创建新的 Telegram 机器人实例
// 参数:
//   - config: 机器人配置，包含 Bot Token、API 地址等
// 返回: TelegramBot 实例指针和可能的错误
func NewTelegramBot(config TelegramBotConfig) (*TelegramBot, error) {
	// 创建 Telegram Bot API 实例
	bot, err := tgbotapi.NewBotAPI(config.BotToken)
	if err != nil {
		return nil, err
	}

	// 关闭调试模式（生产环境建议关闭）
	bot.Debug = false
	log.Printf("Telegram Bot authorized on account %s", bot.Self.UserName)

	// 创建消息处理器
	handler := NewMessageHandler(bot, config)

	// 创建下载客户端
	downloadClient := NewDownloadClient(config.CoreAPI)

	return &TelegramBot{
		bot:            bot,
		config:         config,
		handler:        handler,
		stop:           make(chan bool),
		downloadClient: downloadClient,
	}, nil
}

// Start 启动机器人
// 这个方法会阻塞当前 goroutine 直到机器人被停止
// 建议在单独的 goroutine 中调用此方法
func (tb *TelegramBot) Start() error {
	// 配置更新接收器
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60 // 60秒超时

	// 获取更新通道
	updates := tb.bot.GetUpdatesChan(u)
	log.Printf("Telegram Bot started, waiting for messages...")

	// 主事件循环
	for {
		select {
		case <-tb.stop:
			// 收到停止信号，停止接收更新并退出
			tb.bot.StopReceivingUpdates()
			log.Printf("Telegram Bot stopped")
			return nil

		case update := <-updates:
			// 处理收到的更新
			// 在单独的 goroutine 中处理消息，避免阻塞主循环
			go tb.handler.HandleMessage(update)
		}
	}
}

// Stop 停止机器人
// 发送停止信号，机器人将在处理完当前消息后优雅关闭
func (tb *TelegramBot) Stop() {
	log.Printf("Stopping Telegram Bot...")
	close(tb.stop)
}

// Restart 重启机器人
// 这个方法会停止当前的机器人实例并创建新的实例
// 主要用于配置更新后的重启场景
func (tb *TelegramBot) Restart(newConfig TelegramBotConfig) (*TelegramBot, error) {
	log.Printf("Restarting Telegram Bot...")

	// 停止当前实例
	tb.Stop()

	// 创建新的机器人实例
	newBot, err := NewTelegramBot(newConfig)
	if err != nil {
		return nil, err
	}

	log.Printf("Telegram Bot restarted successfully")
	return newBot, nil
}

// GetConfig 获取当前配置
// 返回机器人的当前配置副本
func (tb *TelegramBot) GetConfig() TelegramBotConfig {
	return tb.config
}

// IsRunning 检查机器人是否正在运行
// 返回 true 表示机器人正在运行，false 表示已停止
func (tb *TelegramBot) IsRunning() bool {
	select {
	case <-tb.stop:
		return false
	default:
		return true
	}
}