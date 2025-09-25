package service

import (
	"context"
	"time"

	"gorm.io/gorm"
	"github.com/matrix/mynest/backend/model"
)

type LogsService struct {
	db *gorm.DB
}

func NewLogsService(db *gorm.DB) *LogsService {
	return &LogsService{
		db: db,
	}
}

type LogEntry struct {
	ID        uint      `json:"id"`
	Level     string    `json:"level"`     // ERROR, INFO, DEBUG, WARN
	Category  string    `json:"category"`  // download, plugin, system
	Message   string    `json:"message"`
	Details   string    `json:"details,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Source    string    `json:"source,omitempty"` // 来源组件
}

type LogsQuery struct {
	Level    string
	Lines    int
	Category string
}

type LogStats struct {
	TotalLogs   int64 `json:"total_logs"`
	ErrorCount  int64 `json:"error_count"`
	InfoCount   int64 `json:"info_count"`
	DebugCount  int64 `json:"debug_count"`
	WarnCount   int64 `json:"warn_count"`
	Categories  map[string]int64 `json:"categories"`
}

func (s *LogsService) GetLogs(ctx context.Context, query LogsQuery) ([]LogEntry, error) {
	// 先检查系统日志表是否存在，不存在则创建
	if !s.db.Migrator().HasTable(&model.SystemLog{}) {
		if err := s.db.AutoMigrate(&model.SystemLog{}); err != nil {
			return nil, err
		}
	}

	dbQuery := s.db.Model(&model.SystemLog{})

	// 应用筛选条件
	if query.Level != "all" {
		dbQuery = dbQuery.Where("level = ?", query.Level)
	}

	if query.Category != "all" {
		dbQuery = dbQuery.Where("category = ?", query.Category)
	}

	// 按时间倒序排列，获取最新的日志
	dbQuery = dbQuery.Order("created_at DESC").Limit(query.Lines)

	var systemLogs []model.SystemLog
	if err := dbQuery.Find(&systemLogs).Error; err != nil {
		return nil, err
	}

	// 转换为响应格式
	logs := make([]LogEntry, len(systemLogs))
	for i, log := range systemLogs {
		logs[i] = LogEntry{
			ID:        log.ID,
			Level:     log.Level,
			Category:  log.Category,
			Message:   log.Message,
			Details:   log.Details,
			Timestamp: log.CreatedAt,
			Source:    log.Source,
		}
	}

	return logs, nil
}

func (s *LogsService) ClearLogs(ctx context.Context, category string) error {
	query := s.db.Model(&model.SystemLog{})

	if category != "all" {
		query = query.Where("category = ?", category)
	}

	return query.Delete(&model.SystemLog{}).Error
}

func (s *LogsService) GetLogStats(ctx context.Context) (*LogStats, error) {
	var stats LogStats

	// 总数统计
	if err := s.db.Model(&model.SystemLog{}).Count(&stats.TotalLogs).Error; err != nil {
		return nil, err
	}

	// 各级别统计
	s.db.Model(&model.SystemLog{}).Where("level = ?", "ERROR").Count(&stats.ErrorCount)
	s.db.Model(&model.SystemLog{}).Where("level = ?", "INFO").Count(&stats.InfoCount)
	s.db.Model(&model.SystemLog{}).Where("level = ?", "DEBUG").Count(&stats.DebugCount)
	s.db.Model(&model.SystemLog{}).Where("level = ?", "WARN").Count(&stats.WarnCount)

	// 分类统计
	var categoryStats []struct {
		Category string
		Count    int64
	}
	s.db.Model(&model.SystemLog{}).
		Select("category, count(*) as count").
		Group("category").
		Find(&categoryStats)

	stats.Categories = make(map[string]int64)
	for _, cat := range categoryStats {
		stats.Categories[cat.Category] = cat.Count
	}

	return &stats, nil
}

// AddLog 添加日志记录（供内部服务调用）
func (s *LogsService) AddLog(ctx context.Context, level, category, message, details, source string) error {
	log := &model.SystemLog{
		Level:     level,
		Category:  category,
		Message:   message,
		Details:   details,
		Source:    source,
		CreatedAt: time.Now(),
	}

	return s.db.Create(log).Error
}