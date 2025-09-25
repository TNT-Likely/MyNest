package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type Config struct {
	BotToken              string
	CoreAPI               string
	AllowedIDs            []int64
	ParseForwardedMsg     bool
	ParseForwardedComment bool
}

type DownloadRequest struct {
	URL        string `json:"url"`
	PluginName string `json:"plugin"`
	Category   string `json:"category"`
}

var urlRegex = regexp.MustCompile(`(https?://[^\s]+|magnet:\?[^\s]+)`)

func main() {
	parseForwarded := os.Getenv("PARSE_FORWARDED_MSG")
	parseComment := os.Getenv("PARSE_FORWARDED_COMMENT")
	config := Config{
		BotToken:              os.Getenv("BOT_TOKEN"),
		CoreAPI:               os.Getenv("CORE_API_URL"),
		AllowedIDs:            parseAllowedIDs(os.Getenv("ALLOWED_USER_IDS")),
		ParseForwardedMsg:     parseForwarded == "" || parseForwarded == "true", // 默认开启
		ParseForwardedComment: parseComment == "" || parseComment == "true",     // 默认开启
	}

	if config.BotToken == "" {
		log.Fatal("BOT_TOKEN is required")
	}
	if config.CoreAPI == "" {
		config.CoreAPI = "http://localhost:8080"
	}

	bot, err := tgbotapi.NewBotAPI(config.BotToken)
	if err != nil {
		log.Fatalf("Failed to create bot: %v", err)
	}

	log.Printf("Telegram Bot authorized: %s", bot.Self.UserName)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := bot.GetUpdatesChan(u)

	for update := range updates {
		if update.Message == nil {
			continue
		}

		log.Printf("Received message from user %d (@%s), Text: '%s', Caption: '%s', Forwarded: %v",
			update.Message.From.ID,
			update.Message.From.UserName,
			update.Message.Text,
			update.Message.Caption,
			update.Message.ForwardFrom != nil)

		if len(config.AllowedIDs) > 0 && !isAllowed(update.Message.From.ID, config.AllowedIDs) {
			log.Printf("User %d not in allowed list, ignoring", update.Message.From.ID)
			continue
		}

		urls := extractURLsFromMessage(update.Message, config.ParseForwardedMsg, config.ParseForwardedComment)
		if len(urls) == 0 {
			log.Printf("No URLs found in message")
			sendMessage(bot, update.Message.Chat.ID, "💡 请发送包含链接的消息，支持 HTTP/HTTPS/Magnet 链接")
			continue
		}

		log.Printf("Found %d URLs: %v", len(urls), urls)

		for _, url := range urls {
			// 处理 Telegram 媒体 URL
			if strings.HasPrefix(url, "telegram:") {
				fileURL, err := getTelegramFileURL(bot, url)
				if err != nil {
					log.Printf("Failed to get Telegram file URL: %v", err)
					sendMessage(bot, update.Message.Chat.ID, fmt.Sprintf("❌ 获取文件失败: %v", err))
					continue
				}
				url = fileURL
				log.Printf("Converted to download URL: %s", url)
			}

			if err := submitDownload(config.CoreAPI, url); err != nil {
				log.Printf("Failed to submit download: %v", err)
				sendMessage(bot, update.Message.Chat.ID, fmt.Sprintf("❌ 归巢失败: %v", err))
			} else {
				sendMessage(bot, update.Message.Chat.ID, "✅ 已归巢")
			}
		}
	}
}

func parseAllowedIDs(str string) []int64 {
	if str == "" {
		return nil
	}

	var ids []int64
	parts := strings.Split(str, ",")
	for _, part := range parts {
		var id int64
		if _, err := fmt.Sscanf(strings.TrimSpace(part), "%d", &id); err == nil {
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

func extractURLsFromMessage(msg *tgbotapi.Message, parseForwarded bool, parseComment bool) []string {
	var allText string
	var textParts []string
	var urls []string

	// 检查转发消息
	isForwarded := msg.ForwardFrom != nil || msg.ForwardFromChat != nil
	if isForwarded {
		log.Printf("Message is forwarded (ForwardFrom: %v, ForwardFromChat: %v)",
			msg.ForwardFrom != nil, msg.ForwardFromChat != nil)

		if !parseForwarded {
			log.Printf("Forwarded message parsing is disabled, skipping")
			return []string{}
		}
	}

	// 从消息文本提取（包含转发评论）
	if msg.Text != "" {
		if isForwarded && !parseComment {
			log.Printf("Forwarded comment parsing is disabled, ignoring text: %s", msg.Text)
		} else {
			textParts = append(textParts, msg.Text)
			if isForwarded {
				log.Printf("Found message text (may include forwarded comment): %s", msg.Text)
			} else {
				log.Printf("Found message text: %s", msg.Text)
			}
		}
	}

	// 如果消息包含 caption（图片、视频等媒体消息的评论）
	if msg.Caption != "" {
		if isForwarded && !parseComment {
			log.Printf("Forwarded comment parsing is disabled, ignoring caption: %s", msg.Caption)
		} else {
			textParts = append(textParts, msg.Caption)
			if isForwarded {
				log.Printf("Found caption (forwarded message comment): %s", msg.Caption)
			} else {
				log.Printf("Found caption: %s", msg.Caption)
			}
		}
	}

	// 检查媒体附件
	if msg.Video != nil {
		log.Printf("Found video attachment: FileID=%s, FileSize=%d", msg.Video.FileID, msg.Video.FileSize)
		urls = append(urls, "telegram:video:"+msg.Video.FileID)
	}
	if msg.Photo != nil && len(msg.Photo) > 0 {
		// 选择最大的照片
		largestPhoto := msg.Photo[len(msg.Photo)-1]
		log.Printf("Found photo attachment: FileID=%s, FileSize=%d", largestPhoto.FileID, largestPhoto.FileSize)
		urls = append(urls, "telegram:photo:"+largestPhoto.FileID)
	}
	if msg.Document != nil {
		log.Printf("Found document attachment: FileID=%s, FileName=%s", msg.Document.FileID, msg.Document.FileName)
		urls = append(urls, "telegram:document:"+msg.Document.FileID)
	}

	// 如果有媒体附件，直接返回
	if len(urls) > 0 {
		log.Printf("Extracted %d media URLs: %v", len(urls), urls)
		return urls
	}

	// 合并所有文本提取 URL
	allText = strings.Join(textParts, " ")
	log.Printf("Combined text for URL extraction: %s", allText)

	// 从所有文本中提取 URL
	urls = extractURLs(allText)

	if len(urls) > 0 {
		log.Printf("Extracted %d URLs from text: %v", len(urls), urls)
	} else {
		log.Printf("No URLs or media found in message")
	}

	return urls
}

type DownloadResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Task    struct {
		ID     int    `json:"id"`
		Status string `json:"status"`
	} `json:"task"`
}

func submitDownload(coreAPI, urlStr string) error {
	req := DownloadRequest{
		URL:        urlStr,
		PluginName: "telegram",
		Category:   "telegram",
	}

	data, err := json.Marshal(req)
	if err != nil {
		return err
	}

	resp, err := http.Post(coreAPI+"/api/v1/download", "application/json", bytes.NewBuffer(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("服务器错误 (状态码: %d)", resp.StatusCode)
	}

	var result DownloadResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("解析响应失败: %w", err)
	}

	if !result.Success || result.Error != "" {
		return fmt.Errorf("%s", result.Error)
	}

	return nil
}

func getTelegramFileURL(bot *tgbotapi.BotAPI, telegramURL string) (string, error) {
	// 解析 telegram:type:fileID
	parts := strings.Split(telegramURL, ":")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid telegram URL format: %s", telegramURL)
	}

	fileID := parts[2]
	fileConfig := tgbotapi.FileConfig{FileID: fileID}

	file, err := bot.GetFile(fileConfig)
	if err != nil {
		// 检查是否是文件过大错误
		if strings.Contains(err.Error(), "file is too big") {
			return "", fmt.Errorf("文件超过 20MB，Telegram Bot API 无法下载。请将文件上传到网盘后发送下载链接")
		}
		return "", fmt.Errorf("获取文件信息失败: %w", err)
	}

	// 构建下载 URL
	downloadURL := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", bot.Token, file.FilePath)
	return downloadURL, nil
}

func sendMessage(bot *tgbotapi.BotAPI, chatID int64, text string) {
	msg := tgbotapi.NewMessage(chatID, text)
	if _, err := bot.Send(msg); err != nil {
		log.Printf("Failed to send message: %v", err)
	}
}