package main

import (
	"fmt"
	"log"
	"regexp"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

// 正则表达式：匹配 HTTP/HTTPS 链接和磁力链接
// 排除常见的分隔符和特殊字符以提高匹配准确性
var urlPattern = regexp.MustCompile(`(https?://[^\s\n\r<>"\'\[\]{}|\\^` + "`" + `]+|magnet:\?[^\s\n\r<>"\'\[\]{}|\\^` + "`" + `]+)`)

// MessageHandler 消息处理器
// 负责处理所有来自 Telegram 的消息，提取链接并提交下载
type MessageHandler struct {
	// bot Telegram Bot API 实例
	bot *tgbotapi.BotAPI

	// config 机器人配置
	config TelegramBotConfig
}

// NewMessageHandler 创建新的消息处理器
// 参数:
//   - bot: Telegram Bot API 实例
//   - config: 机器人配置
// 返回: MessageHandler 实例指针
func NewMessageHandler(bot *tgbotapi.BotAPI, config TelegramBotConfig) *MessageHandler {
	return &MessageHandler{
		bot:    bot,
		config: config,
	}
}

// HandleMessage 处理单个来自 Telegram 的消息
// 这是消息处理的主入口，负责：
// 1. 验证用户权限
// 2. 提取消息中的所有链接
// 3. 提交下载请求
// 4. 向用户发送反馈
func (h *MessageHandler) HandleMessage(update tgbotapi.Update) {
	// 检查消息是否存在
	if update.Message == nil {
		return
	}

	userID := update.Message.From.ID

	// 记录详细的调试信息
	h.logMessageDebugInfo(update.Message)

	// 检查用户权限
	if !isUserAllowed(userID, h.config.AllowedIDs) {
		h.bot.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "❌ 你没有权限使用此机器人"))
		return
	}

	// 提取消息中的所有可下载链接
	urls := h.extractAllURLs(update.Message)

	// 如果没有找到任何链接，通知用户
	if len(urls) == 0 {
		log.Printf("No URLs or downloadable content found in message. Text: '%s', Caption: '%s'", update.Message.Text, update.Message.Caption)
		h.bot.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "❌ 未找到有效的下载链接或可下载内容"))
		return
	}

	log.Printf("Total unique URLs found: %v", urls)

	// 逐个提交下载请求
	for _, url := range urls {
		if err := submitTelegramDownload(h.config.CoreAPI, url); err != nil {
			// 下载提交失败，通知用户具体错误
			h.bot.Send(tgbotapi.NewMessage(update.Message.Chat.ID, fmt.Sprintf("❌ 下载失败: %v", err)))
		} else {
			// 下载提交成功
			h.bot.Send(tgbotapi.NewMessage(update.Message.Chat.ID, "✅ 已添加到下载队列"))
		}
	}
}

// logMessageDebugInfo 记录消息调试信息
func (h *MessageHandler) logMessageDebugInfo(msg *tgbotapi.Message) {
	log.Printf("=== New Message Debug Info ===")
	log.Printf("User ID: %d", msg.From.ID)
	log.Printf("Message Text: '%s'", msg.Text)
	log.Printf("Message Caption: '%s'", msg.Caption)
	log.Printf("Is Forward (ForwardFrom): %t", msg.ForwardFrom != nil)
	log.Printf("Is Forward (ForwardFromChat): %t", msg.ForwardFromChat != nil)
	log.Printf("Is Reply: %t", msg.ReplyToMessage != nil)
	log.Printf("Message Type: %s", h.identifyMessageType(msg))
	log.Printf("Has Photo: %t, Has Video: %t, Has Animation: %t, Has Document: %t",
		msg.Photo != nil, msg.Video != nil, msg.Animation != nil, msg.Document != nil)

	if msg.ForwardFrom != nil {
		log.Printf("Forwarded from user: %s", msg.ForwardFrom.UserName)
	}
	if msg.ForwardFromChat != nil {
		log.Printf("Forwarded from chat: %s", msg.ForwardFromChat.Title)
	}

	log.Printf("Message ID: %d, Date: %d", msg.MessageID, msg.Date)
}

// extractAllURLs 从消息中提取所有可能的URL
func (h *MessageHandler) extractAllURLs(msg *tgbotapi.Message) []string {
	var urls []string

	// 提取消息文本（包括 caption）
	var allTexts []string

	// 主消息文本
	if msg.Text != "" {
		allTexts = append(allTexts, msg.Text)
		log.Printf("Message text: '%s'", msg.Text)
	}

	// 媒体消息的 Caption
	if msg.Caption != "" {
		allTexts = append(allTexts, msg.Caption)
		log.Printf("Message caption: '%s'", msg.Caption)
	}

	// 从所有文本中提取链接
	for _, text := range allTexts {
		foundURLs := h.extractURLsFromText(text)
		if len(foundURLs) > 0 {
			log.Printf("URLs found in text '%s': %v", text, foundURLs)
			urls = append(urls, foundURLs...)
		}
	}

	// 检查消息实体中的链接（包括 caption entities）
	urls = append(urls, h.extractEntityURLs(msg)...)

	// 检查是否是转发消息（任何类型的转发）
	isForwarded := msg.ForwardFrom != nil || msg.ForwardFromChat != nil
	if isForwarded {
		log.Printf("Detected forwarded message (ForwardFrom: %t, ForwardFromChat: %t, ParseForwardedMsg config: %t)",
			msg.ForwardFrom != nil, msg.ForwardFromChat != nil, h.config.ParseForwardedMsg)
		log.Printf("Forwarded message - Text: '%s', Caption: '%s'", msg.Text, msg.Caption)
		log.Printf("Forwarded message media - Photo: %t, Video: %t, Animation: %t",
			msg.Photo != nil, msg.Video != nil, msg.Animation != nil)
		if h.config.ParseForwardedMsg {
			log.Printf("Processing forwarded message content...")
		} else {
			log.Printf("Skipping forwarded message processing due to config setting")
		}
	}

	// 如果是回复消息且配置允许解析回复评论
	if h.config.ParseForwardedComment && msg.ReplyToMessage != nil {
		urls = append(urls, h.extractReplyURLs(msg.ReplyToMessage)...)
	}

	// 如果开启了媒体下载，尝试获取媒体文件链接
	// 只下载图片、视频、GIF类型的媒体文件
	if h.config.DownloadMedia {
		log.Printf("Checking for visual media files (photos, videos, animations). DownloadMedia config: %t, existing URLs: %d", h.config.DownloadMedia, len(urls))

		// 处理图片
		if len(msg.Photo) > 0 {
			log.Printf("Photo message detected, attempting to get download URL...")
			if mediaURL := h.getPhotoURL(msg.Photo); mediaURL != "" {
				log.Printf("Photo download URL obtained")
				urls = append(urls, mediaURL)
			}
		}

		// 处理视频
		if msg.Video != nil {
			log.Printf("Video message detected, attempting to get download URL...")
			if mediaURL := h.getVideoURL(msg.Video); mediaURL != "" {
				log.Printf("Video download URL obtained")
				urls = append(urls, mediaURL)
			}
		}

		// 处理动画/GIF
		if msg.Animation != nil {
			log.Printf("Animation/GIF message detected, attempting to get download URL...")
			if mediaURL := h.getAnimationURL(msg.Animation); mediaURL != "" {
				log.Printf("Animation download URL obtained")
				urls = append(urls, mediaURL)
			}
		}

		// 跳过其他类型的媒体文件（文档、音频、语音等）
		if msg.Document != nil {
			log.Printf("Document message detected, but skipping (only download visual media)")
		}
		if msg.Audio != nil {
			log.Printf("Audio message detected, but skipping (only download visual media)")
		}
		if msg.Voice != nil {
			log.Printf("Voice message detected, but skipping (only download visual media)")
		}

		if len(urls) == 0 {
			log.Printf("No visual media files found or media download failed")
		}
	} else {
		log.Printf("Media download is disabled, skipping media download")
	}

	// 去重
	return h.dedupURLs(urls)
}

// extractEntityURLs 从消息实体中提取URL
func (h *MessageHandler) extractEntityURLs(msg *tgbotapi.Message) []string {
	var urls []string

	// 检查消息实体中的链接
	if msg.Entities != nil {
		log.Printf("Message has %d text entities", len(msg.Entities))
		for _, entity := range msg.Entities {
			log.Printf("Text entity type: %s, offset: %d, length: %d", entity.Type, entity.Offset, entity.Length)
			if entity.Type == "url" || entity.Type == "text_link" {
				var entityURL string
				if entity.Type == "url" && len(msg.Text) >= entity.Offset+entity.Length {
					entityURL = msg.Text[entity.Offset : entity.Offset+entity.Length]
				} else if entity.Type == "text_link" {
					entityURL = entity.URL
				}
				if entityURL != "" {
					log.Printf("Found URL in text entity: %s", entityURL)
					urls = append(urls, entityURL)
				}
			}
		}
	}

	// 检查 caption 实体中的链接
	if msg.CaptionEntities != nil {
		log.Printf("Message has %d caption entities", len(msg.CaptionEntities))
		for _, entity := range msg.CaptionEntities {
			log.Printf("Caption entity type: %s, offset: %d, length: %d", entity.Type, entity.Offset, entity.Length)
			if entity.Type == "url" || entity.Type == "text_link" {
				var entityURL string
				if entity.Type == "url" && len(msg.Caption) >= entity.Offset+entity.Length {
					entityURL = msg.Caption[entity.Offset : entity.Offset+entity.Length]
				} else if entity.Type == "text_link" {
					entityURL = entity.URL
				}
				if entityURL != "" {
					log.Printf("Found URL in caption entity: %s", entityURL)
					urls = append(urls, entityURL)
				}
			}
		}
	}

	return urls
}

// extractReplyURLs 从回复消息中提取URL
func (h *MessageHandler) extractReplyURLs(replyMsg *tgbotapi.Message) []string {
	var urls []string
	var replyTexts []string

	if replyMsg.Text != "" {
		replyTexts = append(replyTexts, replyMsg.Text)
	}
	if replyMsg.Caption != "" {
		replyTexts = append(replyTexts, replyMsg.Caption)
	}

	for _, replyText := range replyTexts {
		if replyText != "" {
			log.Printf("Processing reply text: '%s'", replyText)
			replyURLs := h.extractURLsFromText(replyText)
			if len(replyURLs) > 0 {
				log.Printf("URLs found in reply text: %v", replyURLs)
				urls = append(urls, replyURLs...)
			}
		}
	}

	return urls
}

// getPhotoURL 获取图片的下载URL
func (h *MessageHandler) getPhotoURL(photos []tgbotapi.PhotoSize) string {
	if len(photos) == 0 {
		return ""
	}

	// 获取最大尺寸的图片
	photo := photos[len(photos)-1]
	log.Printf("Found photo message, file ID: %s, will download media", photo.FileID)

	// 获取文件信息
	fileConfig := tgbotapi.FileConfig{FileID: photo.FileID}
	file, err := h.bot.GetFile(fileConfig)
	if err != nil {
		log.Printf("Failed to get photo file info: %v", err)
		return ""
	}

	// 构建文件下载链接（注意：这里暴露了 bot token，在生产环境中需要更安全的方式）
	fileURL := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", h.config.BotToken, file.FilePath)
	log.Printf("Photo download URL generated (token masked for security)")
	return fileURL
}

// getVideoURL 获取视频的下载URL
func (h *MessageHandler) getVideoURL(video *tgbotapi.Video) string {
	if video == nil {
		return ""
	}

	log.Printf("Found video message, file ID: %s, duration: %ds, size: %d bytes", video.FileID, video.Duration, video.FileSize)

	// 获取文件信息
	fileConfig := tgbotapi.FileConfig{FileID: video.FileID}
	file, err := h.bot.GetFile(fileConfig)
	if err != nil {
		log.Printf("Failed to get video file info: %v", err)
		return ""
	}

	// 构建文件下载链接
	fileURL := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", h.config.BotToken, file.FilePath)
	log.Printf("Video download URL generated (token masked for security)")
	return fileURL
}


// getAnimationURL 获取动画/GIF的下载URL
func (h *MessageHandler) getAnimationURL(animation *tgbotapi.Animation) string {
	if animation == nil {
		return ""
	}

	log.Printf("Found animation message, file ID: %s, duration: %ds, size: %d bytes", animation.FileID, animation.Duration, animation.FileSize)

	// 获取文件信息
	fileConfig := tgbotapi.FileConfig{FileID: animation.FileID}
	file, err := h.bot.GetFile(fileConfig)
	if err != nil {
		log.Printf("Failed to get animation file info: %v", err)
		return ""
	}

	// 构建文件下载链接
	fileURL := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", h.config.BotToken, file.FilePath)
	log.Printf("Animation download URL generated (token masked for security)")
	return fileURL
}

// extractURLsFromText 从文本中提取所有匹配的 URL
// 使用正则表达式匹配 HTTP/HTTPS 和磁力链接
func (h *MessageHandler) extractURLsFromText(text string) []string {
	if text == "" {
		log.Printf("extractURLsFromText: empty text input")
		return nil
	}

	urls := urlPattern.FindAllString(text, -1)
	log.Printf("extractURLsFromText: input='%s', found %d URLs: %v", text, len(urls), urls)
	return urls
}

// dedupURLs 去除 URL 列表中的重复项
// 返回去重后的 URL 列表，保持原有顺序
func (h *MessageHandler) dedupURLs(urls []string) []string {
	seen := make(map[string]bool)
	result := []string{}

	for _, url := range urls {
		if url != "" && !seen[url] {
			seen[url] = true
			result = append(result, url)
		}
	}

	return result
}

// identifyMessageType 识别消息类型
// 返回消息的类型字符串，用于调试和日志记录
func (h *MessageHandler) identifyMessageType(msg *tgbotapi.Message) string {
	if msg.Text != "" {
		return "text"
	}
	if msg.Photo != nil {
		return "photo"
	}
	if msg.Video != nil {
		return "video"
	}
	if msg.Document != nil {
		return "document"
	}
	if msg.Audio != nil {
		return "audio"
	}
	if msg.Voice != nil {
		return "voice"
	}
	if msg.VideoNote != nil {
		return "video_note"
	}
	if msg.Sticker != nil {
		return "sticker"
	}
	if msg.Animation != nil {
		return "animation"
	}
	if msg.Contact != nil {
		return "contact"
	}
	if msg.Location != nil {
		return "location"
	}
	return "unknown"
}