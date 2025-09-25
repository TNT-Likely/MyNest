package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// TelegramDownloadRequest 下载请求结构体
// 用于向核心服务提交下载任务
type TelegramDownloadRequest struct {
	// URL 要下载的文件链接
	URL string `json:"url"`

	// PluginName 插件名称，用于标识下载来源
	PluginName string `json:"plugin"`

	// Category 下载分类，用于文件组织
	Category string `json:"category"`
}

// DownloadClient 下载客户端
// 负责与核心服务的下载 API 交互
type DownloadClient struct {
	// coreAPIURL 核心服务的 API 基础地址
	coreAPIURL string
}

// NewDownloadClient 创建新的下载客户端
// 参数:
//   - coreAPIURL: 核心服务的 API 地址，如 "http://localhost:8080/api/v1"
// 返回: DownloadClient 实例指针
func NewDownloadClient(coreAPIURL string) *DownloadClient {
	return &DownloadClient{
		coreAPIURL: coreAPIURL,
	}
}

// SubmitDownload 提交下载任务到核心服务
// 参数:
//   - url: 要下载的文件 URL
//   - pluginName: 插件名称
//   - category: 下载分类
// 返回: 如果提交成功返回 nil，否则返回错误
func (c *DownloadClient) SubmitDownload(url, pluginName, category string) error {
	// 构造下载请求
	req := TelegramDownloadRequest{
		URL:        url,
		PluginName: pluginName,
		Category:   category,
	}

	// 序列化请求为 JSON
	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal download request: %w", err)
	}

	// 发送 HTTP POST 请求到核心服务
	resp, err := http.Post(c.coreAPIURL+"/download", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to send download request: %w", err)
	}
	defer resp.Body.Close()

	// 检查响应状态码
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download service returned status %d", resp.StatusCode)
	}

	return nil
}

// 全局下载客户端实例（向后兼容旧代码）
var globalDownloadClient *DownloadClient

// submitTelegramDownload 向后兼容的下载提交函数
// 这个函数保持与原有代码的兼容性
func submitTelegramDownload(coreAPI, url string) error {
	// 如果全局客户端未初始化，创建一个
	if globalDownloadClient == nil {
		globalDownloadClient = NewDownloadClient(coreAPI)
	}

	// 提交下载任务，使用固定的插件名称和分类
	return globalDownloadClient.SubmitDownload(url, "telegram-bot", "telegram")
}