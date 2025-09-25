package service

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type LogsService struct {
	logDir string
}

func NewLogsService(logDir string) *LogsService {
	// 确保日志目录存在
	if err := os.MkdirAll(logDir, 0755); err != nil {
		panic(fmt.Sprintf("Failed to create log directory: %v", err))
	}

	return &LogsService{
		logDir: logDir,
	}
}

type LogEntry struct {
	Level     string    `json:"level"`
	Category  string    `json:"category"`
	Message   string    `json:"message"`
	Details   string    `json:"details,omitempty"`
	Timestamp time.Time `json:"timestamp"`
	Source    string    `json:"source,omitempty"`
}

type LogsQuery struct {
	Level    string
	Lines    int
	Category string
}

type LogStats struct {
	TotalLogs  int64            `json:"total_logs"`
	ErrorCount int64            `json:"error_count"`
	InfoCount  int64            `json:"info_count"`
	DebugCount int64            `json:"debug_count"`
	WarnCount  int64            `json:"warn_count"`
	Categories map[string]int64 `json:"categories"`
}

func (s *LogsService) GetLogs(ctx context.Context, query LogsQuery) ([]LogEntry, error) {
	logFile := filepath.Join(s.logDir, "app.log")

	file, err := os.Open(logFile)
	if err != nil {
		if os.IsNotExist(err) {
			return []LogEntry{}, nil
		}
		return nil, err
	}
	defer file.Close()

	var logs []LogEntry
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var entry LogEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			// 如果不是JSON格式，跳过
			continue
		}

		// 应用过滤条件
		if query.Level != "all" && entry.Level != query.Level {
			continue
		}
		if query.Category != "all" && entry.Category != query.Category {
			continue
		}

		logs = append(logs, entry)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// 按时间倒序排序
	sort.Slice(logs, func(i, j int) bool {
		return logs[i].Timestamp.After(logs[j].Timestamp)
	})

	// 限制返回数量
	if query.Lines > 0 && len(logs) > query.Lines {
		logs = logs[:query.Lines]
	}

	return logs, nil
}

func (s *LogsService) ClearLogs(ctx context.Context, category string) error {
	logFile := filepath.Join(s.logDir, "app.log")

	if category == "all" {
		// 清空整个日志文件
		return os.Truncate(logFile, 0)
	}

	// 读取现有日志，过滤掉指定分类的日志
	file, err := os.Open(logFile)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	defer file.Close()

	var remainingLogs []string
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var entry LogEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			// 保留非JSON格式的行
			remainingLogs = append(remainingLogs, line)
			continue
		}

		// 保留不是指定分类的日志
		if entry.Category != category {
			remainingLogs = append(remainingLogs, line)
		}
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	// 重写文件
	return os.WriteFile(logFile, []byte(strings.Join(remainingLogs, "\n")+"\n"), 0644)
}

func (s *LogsService) GetLogStats(ctx context.Context) (*LogStats, error) {
	logs, err := s.GetLogs(ctx, LogsQuery{Level: "all", Category: "all", Lines: 0})
	if err != nil {
		return nil, err
	}

	stats := &LogStats{
		Categories: make(map[string]int64),
	}

	stats.TotalLogs = int64(len(logs))

	for _, log := range logs {
		// 统计级别
		switch log.Level {
		case "ERROR":
			stats.ErrorCount++
		case "INFO":
			stats.InfoCount++
		case "DEBUG":
			stats.DebugCount++
		case "WARN":
			stats.WarnCount++
		}

		// 统计分类
		stats.Categories[log.Category]++
	}

	return stats, nil
}

// AddLog 添加日志记录（供内部服务调用）
func (s *LogsService) AddLog(ctx context.Context, level, category, message, details, source string) error {
	entry := LogEntry{
		Level:     level,
		Category:  category,
		Message:   message,
		Details:   details,
		Source:    source,
		Timestamp: time.Now(),
	}

	// 直接写入JSON格式到文件
	logFile := filepath.Join(s.logDir, "app.log")
	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	jsonData, err := json.Marshal(entry)
	if err != nil {
		return err
	}

	_, err = file.Write(append(jsonData, '\n'))
	return err
}

// Info 记录INFO级别日志
func (s *LogsService) Info(category, message, source string) {
	s.AddLog(context.Background(), "INFO", category, message, "", source)
}

// Error 记录ERROR级别日志
func (s *LogsService) Error(category, message, details, source string) {
	s.AddLog(context.Background(), "ERROR", category, message, details, source)
}

// Debug 记录DEBUG级别日志
func (s *LogsService) Debug(category, message, source string) {
	s.AddLog(context.Background(), "DEBUG", category, message, "", source)
}

// Warn 记录WARN级别日志
func (s *LogsService) Warn(category, message, source string) {
	s.AddLog(context.Background(), "WARN", category, message, "", source)
}