package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

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