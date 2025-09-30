package handler

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/matrix/mynest/backend/service"
	"github.com/matrix/mynest/internal/types"
)

type DownloadHandler struct {
	service    *service.DownloadService
	downloader interface {
		TellStatus(ctx interface{}, gid string) (interface{}, error)
	}
}

func NewDownloadHandler(service *service.DownloadService) *DownloadHandler {
	return &DownloadHandler{service: service}
}

func (h *DownloadHandler) SetDownloader(dl interface {
	TellStatus(ctx interface{}, gid string) (interface{}, error)
}) {
	h.downloader = dl
}

func (h *DownloadHandler) SubmitDownload(c *gin.Context) {
	var req types.DownloadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	// 调试日志：打印接收到的请求数据
	fmt.Printf("[DEBUG] SubmitDownload - 接收到的请求: URL=%s, PluginName=%s, Category=%s, Filename=%s\n",
		req.URL, req.PluginName, req.Category, req.Filename)

	task, err := h.service.SubmitDownload(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "任务已归巢",
		"task":    task,
	})
}

func (h *DownloadHandler) ListTasks(c *gin.Context) {
	// 解析查询参数
	var params struct {
		Page       int      `form:"page,default=1"`
		PageSize   int      `form:"page_size,default=20"`
		Statuses   []string `form:"status"`
		PluginName string   `form:"plugin_name"`
		Category   string   `form:"category"`
		Filename   string   `form:"filename"`
	}

	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 手动处理 status 数组参数，支持两种格式：status=a&status=b 和 status[]=a&status[]=b
	statusParams := c.QueryArray("status")
	if len(statusParams) == 0 {
		// 尝试解析 status[] 格式
		statusParams = c.QueryArray("status[]")
	}
	if len(statusParams) > 0 {
		params.Statuses = statusParams
	}

	// Debug: 打印接收到的参数
	fmt.Printf("[DEBUG] ListTasks params: Page=%d, PageSize=%d, Statuses=%v, PluginName=%s, Category=%s, Filename=%s\n",
		params.Page, params.PageSize, params.Statuses, params.PluginName, params.Category, params.Filename)

	// 限制页面大小
	if params.PageSize > 100 {
		params.PageSize = 100
	}
	if params.PageSize < 1 {
		params.PageSize = 20
	}
	if params.Page < 1 {
		params.Page = 1
	}

	result, err := h.service.ListTasksWithPagination(c.Request.Context(), service.TaskQueryParams{
		Page:       params.Page,
		PageSize:   params.PageSize,
		Statuses:   params.Statuses,
		PluginName: params.PluginName,
		Category:   params.Category,
		Filename:   params.Filename,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result.Tasks,
		"pagination": gin.H{
			"page":       params.Page,
			"page_size":  params.PageSize,
			"total":      result.Total,
			"total_pages": (result.Total + int64(params.PageSize) - 1) / int64(params.PageSize),
		},
	})
}

func (h *DownloadHandler) GetTask(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.service.GetTask(c.Request.Context(), uri.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "任务未找到"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"task":    task,
	})
}

func (h *DownloadHandler) RetryTask(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.RetryTask(c.Request.Context(), uri.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "任务已重新开始",
	})
}

func (h *DownloadHandler) DeleteTask(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.DeleteTask(c.Request.Context(), uri.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "任务已删除",
	})
}

func (h *DownloadHandler) PauseTask(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.PauseTask(c.Request.Context(), uri.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "任务已暂停",
	})
}

func (h *DownloadHandler) CheckDownloaderStatus(c *gin.Context) {
	ctx := c.Request.Context()

	status, err := h.service.CheckDownloaderStatus(ctx)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":   false,
			"connected": false,
			"error":     err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"connected": true,
		"status":    status,
	})
}

func (h *DownloadHandler) ClearFailedTasks(c *gin.Context) {
	count, err := h.service.ClearFailedTasks(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("已清理 %d 个失败任务", count),
		"cleared_count": count,
	})
}