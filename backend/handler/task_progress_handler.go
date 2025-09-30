package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/matrix/mynest/backend/service"
)

type TaskProgressHandler struct {
	service *service.DownloadService
}

func NewTaskProgressHandler(service *service.DownloadService) *TaskProgressHandler {
	return &TaskProgressHandler{service: service}
}

func (h *TaskProgressHandler) GetProgress(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的任务 ID"})
		return
	}

	task, err := h.service.GetTask(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务未找到"})
		return
	}

	progress := h.service.GetTaskProgress(c.Request.Context(), task)
	files := h.service.GetTaskFiles(c.Request.Context(), task)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"task":     task,
		"progress": progress,
		"files":    files,
	})
}