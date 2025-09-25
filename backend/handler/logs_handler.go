package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/matrix/mynest/backend/service"
)

type LogsHandler struct {
	service *service.LogsService
}

func NewLogsHandler(service *service.LogsService) *LogsHandler {
	return &LogsHandler{
		service: service,
	}
}

type GetLogsRequest struct {
	Level    string `form:"level"`    // 日志级别：all, error, info, debug
	Lines    int    `form:"lines"`    // 获取行数，默认100
	Follow   bool   `form:"follow"`   // 是否实时跟踪，默认false
	Category string `form:"category"` // 日志类别：all, download, plugin, system
}

func (h *LogsHandler) GetLogs(c *gin.Context) {
	var req GetLogsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 设置默认值
	if req.Lines == 0 {
		req.Lines = 100
	}
	if req.Level == "" {
		req.Level = "all"
	}
	if req.Category == "" {
		req.Category = "all"
	}

	logs, err := h.service.GetLogs(c.Request.Context(), service.LogsQuery{
		Level:    req.Level,
		Lines:    req.Lines,
		Category: req.Category,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs": logs,
		"meta": gin.H{
			"level":    req.Level,
			"lines":    req.Lines,
			"category": req.Category,
		},
	})
}

func (h *LogsHandler) ClearLogs(c *gin.Context) {
	category := c.DefaultQuery("category", "all")

	err := h.service.ClearLogs(c.Request.Context(), category)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "日志已清空"})
}

func (h *LogsHandler) GetLogStats(c *gin.Context) {
	stats, err := h.service.GetLogStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}