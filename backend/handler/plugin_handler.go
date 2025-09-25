package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/matrix/mynest/backend/service"
)

type PluginHandler struct {
	service *service.PluginService
}

func NewPluginHandler(service *service.PluginService) *PluginHandler {
	return &PluginHandler{service: service}
}

func (h *PluginHandler) ListPlugins(c *gin.Context) {
	plugins, err := h.service.ListPlugins(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pluginsWithStatus := make([]map[string]interface{}, len(plugins))
	for i, plugin := range plugins {
		status := h.service.GetPluginStatus(plugin.Name)
		pluginsWithStatus[i] = map[string]interface{}{
			"id":       plugin.ID,
			"name":     plugin.Name,
			"version":  plugin.Version,
			"enabled":  plugin.Enabled,
			"config":   plugin.Config,
			"endpoint": plugin.Endpoint,
			"running":  status["running"],
			"healthy":  status["healthy"],
			"status":   status,
			"created_at": plugin.CreatedAt,
			"updated_at": plugin.UpdatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"plugins": pluginsWithStatus,
	})
}

func (h *PluginHandler) EnablePlugin(c *gin.Context) {
	name := c.Param("name")

	var req struct {
		Config map[string]interface{} `json:"config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.EnablePlugin(c.Request.Context(), name, req.Config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "插件已启用",
	})
}

func (h *PluginHandler) DisablePlugin(c *gin.Context) {
	name := c.Param("name")

	if err := h.service.DisablePlugin(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "插件已禁用",
	})
}

func (h *PluginHandler) StartPlugin(c *gin.Context) {
	name := c.Param("name")

	if err := h.service.StartPlugin(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "插件已启动",
	})
}

func (h *PluginHandler) StopPlugin(c *gin.Context) {
	name := c.Param("name")

	if err := h.service.StopPlugin(c.Request.Context(), name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "插件已停止",
	})
}

func (h *PluginHandler) RestartPlugin(c *gin.Context) {
	name := c.Param("name")

	var req struct {
		Config map[string]interface{} `json:"config"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		// 如果没有提供配置，使用现有配置重启
		if err := h.service.RestartPlugin(c.Request.Context(), name, nil); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		// 使用新配置重启
		if err := h.service.RestartPlugin(c.Request.Context(), name, req.Config); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "插件已重启",
	})
}

func (h *PluginHandler) GetPluginLogs(c *gin.Context) {
	name := c.Param("name")
	lines := 100 // 默认100行

	if linesParam := c.Query("lines"); linesParam != "" {
		if n, err := strconv.Atoi(linesParam); err == nil && n > 0 {
			lines = n
		}
	}

	logs := h.service.GetPluginLogs(name, lines)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"logs":    logs,
	})
}