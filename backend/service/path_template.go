package service

import (
	"crypto/rand"
	"encoding/hex"
	"path/filepath"
	"strings"
	"time"
)

// ApplyPathTemplate 应用路径模板
// 支持的变量:
// {plugin} - 插件名称
// {date} - 下载日期 (YYYY-MM-DD)
// {datetime} - 下载日期时间 (YYYY-MM-DD_HH-MM-SS)
// {filename} - 文件名
// {random} - 随机字符串 (8位十六进制)
func ApplyPathTemplate(template, pluginName, filename string) string {
	now := time.Now()

	replacements := map[string]string{
		"{plugin}":   pluginName,
		"{date}":     now.Format("2006-01-02"),
		"{datetime}": now.Format("2006-01-02_15-04-05"),
		"{filename}": filename,
		"{random}":   generateRandomString(),
	}

	result := template
	for placeholder, value := range replacements {
		result = strings.ReplaceAll(result, placeholder, value)
	}

	isDir := strings.HasSuffix(result, "/")
	result = filepath.Clean(result)

	if isDir && !strings.HasSuffix(result, "/") {
		result += "/"
	}

	return result
}

func generateRandomString() string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// GetDefaultTemplate 返回默认路径模板
func GetDefaultTemplate() string {
	return "{plugin}/{date}/{filename}"
}