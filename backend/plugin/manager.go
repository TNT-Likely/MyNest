package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/matrix/mynest/backend/model"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Manager struct {
	db      *gorm.DB
	plugins map[string]*PluginClient
	mu      sync.RWMutex
}

type PluginClient struct {
	Name       string
	Endpoint   string
	Conn       *grpc.ClientConn
	GRPCClient interface{}
	LastPing   time.Time
	Healthy    bool
}

func NewManager(db *gorm.DB) *Manager {
	return &Manager{
		db:      db,
		plugins: make(map[string]*PluginClient),
	}
}

func (m *Manager) RegisterPlugin(ctx context.Context, name, endpoint string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	conn, err := grpc.NewClient(endpoint, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return fmt.Errorf("failed to connect to plugin: %w", err)
	}

	client := &PluginClient{
		Name:     name,
		Endpoint: endpoint,
		Conn:     conn,
	}

	m.plugins[name] = client

	var plugin model.Plugin
	result := m.db.Where("name = ?", name).First(&plugin)
	if result.Error == gorm.ErrRecordNotFound {
		plugin = model.Plugin{
			Name:     name,
			Endpoint: endpoint,
			Enabled:  false,
		}
		if err := m.db.Create(&plugin).Error; err != nil {
			return fmt.Errorf("failed to save plugin: %w", err)
		}
	} else if result.Error != nil {
		return result.Error
	} else {
		plugin.Endpoint = endpoint
		if err := m.db.Save(&plugin).Error; err != nil {
			return fmt.Errorf("failed to update plugin: %w", err)
		}
	}

	return nil
}

func (m *Manager) GetPlugin(name string) (*PluginClient, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	client, ok := m.plugins[name]
	if !ok {
		return nil, fmt.Errorf("plugin %s not found", name)
	}

	return client, nil
}

func (m *Manager) ListPlugins() ([]*model.Plugin, error) {
	var plugins []*model.Plugin
	if err := m.db.Find(&plugins).Error; err != nil {
		return nil, err
	}
	return plugins, nil
}

func (m *Manager) EnablePlugin(ctx context.Context, name string, config map[string]interface{}) error {
	var plugin model.Plugin
	if err := m.db.Where("name = ?", name).First(&plugin).Error; err != nil {
		return err
	}

	plugin.Enabled = true

	configBytes, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	plugin.Config = datatypes.JSON(configBytes)

	if err := m.db.Save(&plugin).Error; err != nil {
		return err
	}

	return nil
}

func (m *Manager) DisablePlugin(ctx context.Context, name string) error {
	var plugin model.Plugin
	if err := m.db.Where("name = ?", name).First(&plugin).Error; err != nil {
		return err
	}

	plugin.Enabled = false
	if err := m.db.Save(&plugin).Error; err != nil {
		return err
	}

	return nil
}

// CheckPluginHealth 检查插件健康状态
func (m *Manager) CheckPluginHealth(name string) bool {
	m.mu.RLock()
	client, exists := m.plugins[name]
	m.mu.RUnlock()

	if !exists {
		return false
	}

	if client.Conn == nil {
		return false
	}

	// 简单的连接状态检查
	state := client.Conn.GetState()
	healthy := state.String() == "READY" || state.String() == "CONNECTING"

	// 更新健康状态
	m.mu.Lock()
	client.LastPing = time.Now()
	client.Healthy = healthy
	m.mu.Unlock()

	if healthy {
		log.Printf("Plugin %s is healthy", name)
	} else {
		log.Printf("Plugin %s is unhealthy, state: %s", name, state.String())
	}

	return healthy
}

// GetPluginStatus 获取插件状态
func (m *Manager) GetPluginStatus(name string) map[string]interface{} {
	m.mu.RLock()
	client, exists := m.plugins[name]
	m.mu.RUnlock()

	if !exists {
		return map[string]interface{}{
			"running": false,
			"healthy": false,
			"status":  "not_found",
		}
	}

	return map[string]interface{}{
		"running":   client.Conn != nil,
		"healthy":   client.Healthy,
		"last_ping": client.LastPing,
		"endpoint":  client.Endpoint,
		"status":    "connected",
	}
}

// StartHealthChecker 启动健康检查器
func (m *Manager) StartHealthChecker() {
	go func() {
		ticker := time.NewTicker(30 * time.Second) // 每30秒检查一次
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				m.mu.RLock()
				plugins := make([]string, 0, len(m.plugins))
				for name := range m.plugins {
					plugins = append(plugins, name)
				}
				m.mu.RUnlock()

				for _, name := range plugins {
					m.CheckPluginHealth(name)
				}
			}
		}
	}()
}

func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, client := range m.plugins {
		if client.Conn != nil {
			client.Conn.Close()
		}
	}

	return nil
}