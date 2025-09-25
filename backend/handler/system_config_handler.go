package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/matrix/mynest/backend/service"
)

type SystemConfigHandler struct {
	service *service.SystemConfigService
}

func NewSystemConfigHandler(service *service.SystemConfigService) *SystemConfigHandler {
	return &SystemConfigHandler{service: service}
}

func (h *SystemConfigHandler) GetAllConfigs(c *gin.Context) {
	configs, err := h.service.GetAllConfigs(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"configs": configs,
	})
}

func (h *SystemConfigHandler) UpdateConfig(c *gin.Context) {
	var req struct {
		Key   string `json:"key" binding:"required"`
		Value string `json:"value" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.SetConfig(c.Request.Context(), req.Key, req.Value); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "配置已更新",
	})
}