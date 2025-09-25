package plugin

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/matrix/mynest/backend/model"
	"gorm.io/gorm"
)

type PluginRunner struct {
	db        *gorm.DB
	processes map[string]*PluginProcess
	mu        sync.RWMutex
}

type PluginProcess struct {
	Name    string
	Cmd     *exec.Cmd
	Running bool
	Logs    []string
	LogsMu  sync.RWMutex
}

func NewPluginRunner(db *gorm.DB) *PluginRunner {
	return &PluginRunner{
		db:        db,
		processes: make(map[string]*PluginProcess),
	}
}

func (r *PluginRunner) StartEnabledPlugins() error {
	var plugins []model.Plugin
	if err := r.db.Where("enabled = ?", true).Find(&plugins).Error; err != nil {
		return err
	}

	for _, plugin := range plugins {
		if err := r.StartPlugin(context.Background(), plugin.Name); err != nil {
			log.Printf("Failed to start plugin %s: %v", plugin.Name, err)
		}
	}

	return nil
}

func (r *PluginRunner) StartPlugin(ctx context.Context, name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if proc, exists := r.processes[name]; exists && proc.Running {
		return fmt.Errorf("plugin %s is already running", name)
	}

	var plugin model.Plugin
	if err := r.db.Where("name = ? AND enabled = ?", name, true).First(&plugin).Error; err != nil {
		return err
	}

	var config map[string]interface{}
	if len(plugin.Config) > 0 {
		if err := json.Unmarshal(plugin.Config, &config); err != nil {
			return fmt.Errorf("failed to unmarshal config: %w", err)
		}
	}

	cmd, err := r.buildPluginCommand(plugin.Name, config)
	if err != nil {
		return err
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start plugin: %w", err)
	}

	proc := &PluginProcess{
		Name:    name,
		Cmd:     cmd,
		Running: true,
		Logs:    make([]string, 0, 1000),
	}

	r.processes[name] = proc

	// 捕获 stdout 日志
	go r.captureLog(proc, stdout, "stdout")
	// 捕获 stderr 日志
	go r.captureLog(proc, stderr, "stderr")

	// 等待进程结束
	go func() {
		err := cmd.Wait()
		r.mu.Lock()
		if p, exists := r.processes[name]; exists {
			p.Running = false
			if err != nil {
				log.Printf("Plugin %s exited with error: %v", name, err)
				p.addLog(fmt.Sprintf("[ERROR] Plugin exited: %v", err))
			} else {
				log.Printf("Plugin %s exited normally", name)
			}
		}
		r.mu.Unlock()
	}()

	log.Printf("Plugin %s started successfully", name)
	return nil
}

func (r *PluginRunner) StopPlugin(ctx context.Context, name string) error {
	r.mu.Lock()
	proc, exists := r.processes[name]
	if !exists || !proc.Running {
		r.mu.Unlock()
		return fmt.Errorf("plugin %s is not running", name)
	}

	if err := proc.Cmd.Process.Kill(); err != nil {
		r.mu.Unlock()
		return fmt.Errorf("failed to kill plugin: %w", err)
	}

	proc.Running = false
	cmd := proc.Cmd
	r.mu.Unlock()

	// 等待进程真正结束
	go func() {
		cmd.Wait()
		log.Printf("Plugin %s process has fully terminated", name)
	}()

	log.Printf("Plugin %s stopped", name)
	return nil
}

func (r *PluginRunner) IsPluginRunning(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	proc, exists := r.processes[name]
	return exists && proc.Running
}

func (r *PluginRunner) buildPluginCommand(name string, config map[string]interface{}) (*exec.Cmd, error) {
	switch name {
	case "telegram-bot":
		var cmd *exec.Cmd

		// 检查是否在 Docker 环境中（通过检查二进制文件是否存在）
		if _, err := os.Stat("./telegram-bot"); err == nil {
			// Docker 环境：使用编译好的二进制文件
			cmd = exec.Command("./telegram-bot")
		} else {
			// 本地开发环境：使用 go run . (运行当前目录的包)
			cmd = exec.Command("go", "run", ".")
			// 设置工作目录为插件目录
			cmd.Dir = "plugins/telegram-bot"
		}

		if botToken, ok := config["bot_token"].(string); ok && botToken != "" {
			cmd.Env = append(os.Environ(), fmt.Sprintf("BOT_TOKEN=%s", botToken))
		}

		if apiURL, ok := config["core_api_url"].(string); ok && apiURL != "" {
			cmd.Env = append(cmd.Env, fmt.Sprintf("CORE_API_URL=%s", apiURL))
		} else {
			cmd.Env = append(cmd.Env, "CORE_API_URL=http://localhost:8080/api/v1")
		}

		if allowedIDs, ok := config["allowed_user_ids"].(string); ok && allowedIDs != "" {
			cmd.Env = append(cmd.Env, fmt.Sprintf("ALLOWED_USER_IDS=%s", allowedIDs))
		}

		if parseForwarded, ok := config["parse_forwarded_msg"].(string); ok && parseForwarded != "" {
			cmd.Env = append(cmd.Env, fmt.Sprintf("PARSE_FORWARDED_MSG=%s", parseForwarded))
		} else {
			cmd.Env = append(cmd.Env, "PARSE_FORWARDED_MSG=true") // 默认开启
		}

		if parseComment, ok := config["parse_forwarded_comment"].(string); ok && parseComment != "" {
			cmd.Env = append(cmd.Env, fmt.Sprintf("PARSE_FORWARDED_COMMENT=%s", parseComment))
		} else {
			cmd.Env = append(cmd.Env, "PARSE_FORWARDED_COMMENT=true") // 默认开启
		}

		if downloadMedia, ok := config["download_media"].(string); ok && downloadMedia != "" {
			cmd.Env = append(cmd.Env, fmt.Sprintf("DOWNLOAD_MEDIA=%s", downloadMedia))
		}
		// 不设置默认值，让插件代码自己处理默认逻辑

		return cmd, nil

	default:
		return nil, fmt.Errorf("unknown plugin: %s", name)
	}
}

func (r *PluginRunner) GetPluginLogs(name string, lines int) []string {
	r.mu.RLock()
	proc, exists := r.processes[name]
	r.mu.RUnlock()

	if !exists {
		return []string{}
	}

	proc.LogsMu.RLock()
	defer proc.LogsMu.RUnlock()

	totalLogs := len(proc.Logs)
	if lines <= 0 || lines > totalLogs {
		lines = totalLogs
	}

	start := totalLogs - lines
	if start < 0 {
		start = 0
	}

	return proc.Logs[start:]
}

func (r *PluginRunner) captureLog(proc *PluginProcess, reader io.ReadCloser, source string) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		timestamp := time.Now().Format("2006-01-02 15:04:05")
		logLine := fmt.Sprintf("[%s] [%s] %s", timestamp, source, line)
		proc.addLog(logLine)
		log.Println(logLine)
	}
}

func (p *PluginProcess) addLog(line string) {
	p.LogsMu.Lock()
	defer p.LogsMu.Unlock()

	// 保持最多 1000 行日志
	if len(p.Logs) >= 1000 {
		p.Logs = p.Logs[1:]
	}
	p.Logs = append(p.Logs, line)
}

func (r *PluginRunner) StopAll() {
	r.mu.Lock()
	defer r.mu.Unlock()

	for name, proc := range r.processes {
		if proc.Running && proc.Cmd.Process != nil {
			proc.Cmd.Process.Kill()
			log.Printf("Plugin %s stopped", name)
		}
	}
}