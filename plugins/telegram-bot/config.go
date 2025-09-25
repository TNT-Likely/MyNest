package main

import (
	"strconv"
	"strings"
)

// TelegramBotConfig Telegram Bot 配置结构
// 包含所有运行 Telegram Bot 所需的配置选项
type TelegramBotConfig struct {
	// BotToken Telegram Bot API Token，从 @BotFather 获取
	BotToken string

	// CoreAPI 核心服务的 API 地址，用于提交下载请求
	CoreAPI string

	// AllowedIDs 允许使用机器人的用户ID列表，为空则允许所有用户
	AllowedIDs []int64

	// ParseForwardedMsg 是否解析转发消息中的链接
	ParseForwardedMsg bool

	// ParseForwardedComment 是否解析回复消息中的链接
	ParseForwardedComment bool

	// DownloadMedia 是否下载媒体文件（图片、视频等）
	// 启用后，纯图片消息也会被下载
	DownloadMedia bool
}

// parseAllowedUserIDs 解析允许使用机器人的用户ID字符串
// 输入格式: "123456789,987654321,555666777"
// 返回: []int64{123456789, 987654321, 555666777}
func parseAllowedUserIDs(idsStr string) []int64 {
	// 如果输入为空，返回 nil 表示允许所有用户
	if idsStr == "" {
		return nil
	}

	// 按逗号分割用户ID字符串
	parts := strings.Split(idsStr, ",")
	var ids []int64

	// 遍历每个部分，尝试解析为int64
	for _, part := range parts {
		part = strings.TrimSpace(part) // 去掉前后空格
		if id, err := strconv.ParseInt(part, 10, 64); err == nil {
			ids = append(ids, id)
		}
		// 忽略解析失败的部分，继续处理其他ID
	}
	return ids
}

// isUserAllowed 检查用户是否有权限使用机器人
// 如果 allowedIDs 为空，则允许所有用户
func isUserAllowed(userID int64, allowedIDs []int64) bool {
	// 如果没有设置允许的用户列表，允许所有用户
	if len(allowedIDs) == 0 {
		return true
	}

	// 检查用户ID是否在允许列表中
	for _, id := range allowedIDs {
		if id == userID {
			return true
		}
	}
	return false
}