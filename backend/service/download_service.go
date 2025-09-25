package service

import (
	"context"
	"fmt"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/matrix/mynest/backend/downloader"
	"github.com/matrix/mynest/backend/model"
	"github.com/matrix/mynest/internal/types"
	"gorm.io/gorm"
)

type DownloadService struct {
	db           *gorm.DB
	downloader   downloader.Downloader
	configService *SystemConfigService
}

func NewDownloadService(db *gorm.DB, dl downloader.Downloader) *DownloadService {
	return &DownloadService{
		db:           db,
		downloader:   dl,
		configService: NewSystemConfigService(db),
	}
}

func (s *DownloadService) SubmitDownload(ctx context.Context, req types.DownloadRequest) (*model.DownloadTask, error) {
	task := &model.DownloadTask{
		URL:        req.URL,
		Filename:   req.Filename,
		PluginName: req.PluginName,
		Category:   req.Category,
		Status:     string(types.TaskStatusPending),
	}

	if err := s.db.Create(task).Error; err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	// 获取路径模板配置
	pathTemplate, err := s.configService.GetConfig(ctx, "download_path_template")
	if err != nil || pathTemplate == "" {
		pathTemplate = GetDefaultTemplate()
	}

	// 优先级：1. 请求中的 filename  2. URL 中的文件名  3. Content-Type 检测
	filename := req.Filename
	if filename == "" {
		// 尝试从 URL 提取文件名
		filename = s.extractFilenameFromURL(req.URL)
		if filename == "" {
			// URL 中没有文件名，通过 Content-Type 检测
			filename = s.detectFilenameByContentType(ctx, req.URL)
			log.Printf("[Download] Detected filename by Content-Type: %s", filename)
		} else {
			log.Printf("[Download] Extracted filename from URL: %s", filename)
		}
	}

	// 应用路径模板
	downloadPath := ApplyPathTemplate(pathTemplate, req.PluginName, filename)
	log.Printf("[Download] Template: %s, Plugin: %s, Filename: %s, Result: %s",
		pathTemplate, req.PluginName, filename, downloadPath)

	// 获取 aria2 基础下载目录
	baseDir, err := s.configService.GetConfig(ctx, "aria2_download_dir")
	if err != nil || baseDir == "" {
		opts, err := s.downloader.GetGlobalOption(ctx)
		if err == nil {
			if dir, ok := opts["dir"].(string); ok && dir != "" {
				baseDir = dir
			}
		}
	}

	if baseDir == "" {
		task.Status = string(types.TaskStatusFailed)
		task.ErrorMsg = "无法获取下载目录，请在系统配置中设置 aria2 下载目录"
		s.db.Save(task)
		return nil, fmt.Errorf("下载目录未配置")
	}

	options := make(map[string]interface{})
	if downloadPath != "" {
		if strings.HasSuffix(downloadPath, "/") {
			// 只有目录，让 aria2 自动命名
			dirPath := strings.TrimSuffix(downloadPath, "/")
			fullPath := filepath.Join(baseDir, dirPath)
			if err := os.MkdirAll(fullPath, 0755); err != nil {
				log.Printf("[Download] Failed to create directory %s: %v", fullPath, err)
			} else {
				log.Printf("[Download] Created directory: %s", fullPath)
			}
			options["dir"] = fullPath
			log.Printf("[Download] Using dir mode: %s", fullPath)
		} else {
			// 有完整路径，拆分成 dir 和 out
			dirPath := filepath.Dir(downloadPath)
			fileName := filepath.Base(downloadPath)
			fullDirPath := filepath.Join(baseDir, dirPath)

			if err := os.MkdirAll(fullDirPath, 0755); err != nil {
				log.Printf("[Download] Failed to create directory %s: %v", fullDirPath, err)
			} else {
				log.Printf("[Download] Created directory: %s", fullDirPath)
			}

			options["dir"] = fullDirPath
			options["out"] = fileName
			task.Filename = fileName // 保存文件名到任务
			log.Printf("[Download] Using dir=%s, out=%s", fullDirPath, fileName)
		}
	}

	gid, err := s.downloader.AddURI(ctx, []string{req.URL}, options)
	if err != nil {
		task.Status = string(types.TaskStatusFailed)
		task.ErrorMsg = err.Error()
		s.db.Save(task)

		log.Printf("[DownloadService] ❌ 下载任务添加失败: URL=%s, Plugin=%s, Error=%v", req.URL, req.PluginName, err)
		log.Printf("[DownloadService] 下载任务失败: %s, 错误: %v", req.URL, err)

		return nil, fmt.Errorf("failed to add download: %w", err)
	}

	task.GID = gid
	task.Status = string(types.TaskStatusDownloading)
	if err := s.db.Save(task).Error; err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	// TODO: 记录下载开始日志
	log.Printf("[DownloadService] 开始下载任务: %s, GID: %s, Plugin: %s", req.URL, gid, req.PluginName)

	return task, nil
}

func (s *DownloadService) GetTask(ctx context.Context, id uint) (*model.DownloadTask, error) {
	var task model.DownloadTask
	if err := s.db.First(&task, id).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

func (s *DownloadService) ListTasks(ctx context.Context) ([]*model.DownloadTask, error) {
	var tasks []*model.DownloadTask
	if err := s.db.Order("created_at DESC").Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

// TaskQueryParams 任务查询参数
type TaskQueryParams struct {
	Page        int
	PageSize    int
	Statuses    []string
	PluginName  string
	Category    string
	Filename    string
	HideSuccess bool
}

// TaskQueryResult 任务查询结果
type TaskQueryResult struct {
	Tasks []*model.DownloadTask
	Total int64
}

func (s *DownloadService) ListTasksWithPagination(ctx context.Context, params TaskQueryParams) (*TaskQueryResult, error) {
	query := s.db.Model(&model.DownloadTask{})

	// 应用筛选条件
	if len(params.Statuses) > 0 {
		query = query.Where("status IN ?", params.Statuses)
	}

	if params.PluginName != "" {
		query = query.Where("plugin_name = ?", params.PluginName)
	}

	if params.Category != "" {
		query = query.Where("category = ?", params.Category)
	}

	if params.Filename != "" {
		query = query.Where("filename ILIKE ?", "%"+params.Filename+"%")
	}

	// 默认隐藏成功的任务
	if params.HideSuccess {
		query = query.Where("status != ?", "completed")
	}

	// 计算总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	// 应用分页
	offset := (params.Page - 1) * params.PageSize
	query = query.Offset(offset).Limit(params.PageSize)

	// 查询数据
	var tasks []*model.DownloadTask
	if err := query.Order("created_at DESC").Find(&tasks).Error; err != nil {
		return nil, err
	}

	return &TaskQueryResult{
		Tasks: tasks,
		Total: total,
	}, nil
}

func (s *DownloadService) UpdateTaskStatus(ctx context.Context, id uint, status types.TaskStatus) error {
	return s.db.Model(&model.DownloadTask{}).Where("id = ?", id).Update("status", string(status)).Error
}

func (s *DownloadService) RetryTask(ctx context.Context, id uint) error {
	task, err := s.GetTask(ctx, id)
	if err != nil {
		return err
	}

	if task.GID != "" {
		s.downloader.Remove(ctx, task.GID)
	}

	options := make(map[string]interface{})
	if task.Filename != "" {
		options["out"] = task.Filename
	}

	gid, err := s.downloader.AddURI(ctx, []string{task.URL}, options)
	if err != nil {
		return fmt.Errorf("failed to retry download: %w", err)
	}

	updates := map[string]interface{}{
		"gid":       gid,
		"status":    string(types.TaskStatusPending),
		"error_msg": "",
	}

	return s.db.Model(task).Updates(updates).Error
}

func (s *DownloadService) DeleteTask(ctx context.Context, id uint) error {
	task, err := s.GetTask(ctx, id)
	if err != nil {
		return err
	}

	if task.GID != "" {
		s.downloader.Remove(ctx, task.GID)
	}

	return s.db.Delete(task).Error
}

func (s *DownloadService) PauseTask(ctx context.Context, id uint) error {
	task, err := s.GetTask(ctx, id)
	if err != nil {
		return err
	}

	if task.GID == "" {
		return fmt.Errorf("task has no GID")
	}

	if task.Status == string(types.TaskStatusPaused) {
		if err := s.downloader.Unpause(ctx, task.GID); err != nil {
			return err
		}
		return s.db.Model(task).Update("status", string(types.TaskStatusDownloading)).Error
	}

	if err := s.downloader.Pause(ctx, task.GID); err != nil {
		return err
	}

	return s.db.Model(task).Update("status", string(types.TaskStatusPaused)).Error
}

type TaskProgress struct {
	TotalLength     int64   `json:"total_length"`
	CompletedLength int64   `json:"completed_length"`
	DownloadSpeed   int64   `json:"download_speed"`
	Progress        float64 `json:"progress"`
	Status          string  `json:"status"`
}

func (s *DownloadService) GetTaskProgress(ctx context.Context, task *model.DownloadTask) *TaskProgress {
	progress := &TaskProgress{
		Status: task.Status,
	}

	if task.GID == "" {
		return progress
	}

	status, err := s.downloader.TellStatus(ctx, task.GID)
	if err != nil {
		return progress
	}

	progress.TotalLength = status.TotalLength
	progress.CompletedLength = status.CompletedLength
	progress.DownloadSpeed = status.DownloadSpeed

	if status.TotalLength > 0 {
		progress.Progress = float64(status.CompletedLength) / float64(status.TotalLength) * 100
	}

	return progress
}

func (s *DownloadService) extractFilenameFromURL(urlStr string) string {
	// 从 URL 路径中提取文件名
	idx := strings.LastIndex(urlStr, "/")
	if idx == -1 {
		return ""
	}

	filename := urlStr[idx+1:]

	// 去掉查询参数
	if qIdx := strings.Index(filename, "?"); qIdx != -1 {
		filename = filename[:qIdx]
	}

	// URL 解码（处理 %E4%BB%AA 这样的编码）
	decoded, err := url.QueryUnescape(filename)
	if err == nil {
		filename = decoded
	}

	// 检查是否有有效的扩展名
	if strings.Contains(filename, ".") && len(filename) > 1 {
		return filename
	}

	return ""
}

func (s *DownloadService) detectFilenameByContentType(ctx context.Context, urlStr string) string {
	// 发送 HEAD 请求获取 Content-Type
	resp, err := http.Head(urlStr)
	if err != nil {
		log.Printf("[Download] Failed to HEAD request: %v", err)
		return ""
	}
	defer resp.Body.Close()

	// 从 Content-Type 获取扩展名
	contentType := resp.Header.Get("Content-Type")
	if contentType != "" {
		// 去掉参数部分，如 "image/jpeg; charset=utf-8" -> "image/jpeg"
		if idx := strings.Index(contentType, ";"); idx != -1 {
			contentType = contentType[:idx]
		}
		contentType = strings.TrimSpace(contentType)

		// 获取扩展名
		exts, err := mime.ExtensionsByType(contentType)
		if err == nil && len(exts) > 0 {
			ext := exts[0] // 使用第一个扩展名
			timestamp := time.Now().Unix()
			filename := fmt.Sprintf("file_%d%s", timestamp, ext)
			log.Printf("[Download] Content-Type: %s, detected extension: %s, filename: %s", contentType, ext, filename)
			return filename
		}
	}

	return ""
}

func (s *DownloadService) CheckDownloaderStatus(ctx context.Context) (map[string]interface{}, error) {
	version, err := s.downloader.GetVersion(ctx)
	if err != nil {
		return nil, fmt.Errorf("aria2 连接失败")
	}

	// 获取全局配置以读取下载目录
	opts, err := s.downloader.GetGlobalOption(ctx)
	if err == nil {
		if dir, ok := opts["dir"].(string); ok {
			version["dir"] = dir
		}
	}

	return version, nil
}

func (s *DownloadService) ClearFailedTasks(ctx context.Context) (int64, error) {
	// 查询所有失败的任务
	var failedTasks []*model.DownloadTask
	if err := s.db.Where("status = ?", "failed").Find(&failedTasks).Error; err != nil {
		return 0, err
	}

	// 从 aria2 中移除这些任务（如果有 GID）
	for _, task := range failedTasks {
		if task.GID != "" {
			// 忽略 aria2 移除错误，因为任务可能已经不在 aria2 中了
			s.downloader.Remove(ctx, task.GID)
		}
	}

	// 删除数据库中的失败任务
	result := s.db.Where("status = ?", "failed").Delete(&model.DownloadTask{})
	if result.Error != nil {
		return 0, result.Error
	}

	return result.RowsAffected, nil
}