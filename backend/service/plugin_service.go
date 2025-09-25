package service

import (
	"context"
	"log"
	"os"

	"github.com/matrix/mynest/backend/model"
	"github.com/matrix/mynest/backend/plugin"
)

type PluginService struct {
	manager *plugin.Manager
	runner  *plugin.PluginRunner
}

func NewPluginService(manager *plugin.Manager, runner *plugin.PluginRunner) *PluginService {
	return &PluginService{
		manager: manager,
		runner:  runner,
	}
}

func (s *PluginService) ListPlugins(ctx context.Context) ([]*model.Plugin, error) {
	return s.manager.ListPlugins()
}

func (s *PluginService) EnablePlugin(ctx context.Context, name string, config map[string]interface{}) error {
	if err := s.manager.EnablePlugin(ctx, name, config); err != nil {
		return err
	}

	// 通过环境变量判断运行模式
	runMode := os.Getenv("RUN_MODE")
	if runMode == "" {
		runMode = "development" // 默认为开发模式
	}

	if runMode == "production" || runMode == "release" {
		// 生产环境：插件已由 supervisord 启动，只需建立 gRPC 连接
		log.Printf("[PluginService] 生产环境模式 (%s)：插件 %s 由 supervisord 管理，建立 gRPC 连接", runMode, name)
		return nil
	} else {
		// 开发环境：通过 PluginRunner 启动插件进程
		log.Printf("[PluginService] 开发环境模式 (%s)：通过 PluginRunner 启动插件 %s", runMode, name)
		return s.runner.StartPlugin(ctx, name)
	}
}

func (s *PluginService) DisablePlugin(ctx context.Context, name string) error {
	// 通过环境变量判断运行模式
	runMode := os.Getenv("RUN_MODE")
	if runMode == "" {
		runMode = "development"
	}

	if runMode == "production" || runMode == "release" {
		// 生产环境：插件由 supervisord 管理，只需断开 gRPC 连接
		log.Printf("[PluginService] 生产环境模式 (%s)：断开插件 %s 的 gRPC 连接", runMode, name)
	} else {
		// 开发环境：停止 PluginRunner 管理的进程
		if err := s.runner.StopPlugin(ctx, name); err != nil {
			log.Printf("[PluginService] 开发环境模式 (%s)：停止插件 %s 进程失败: %v", runMode, name, err)
		}
	}

	return s.manager.DisablePlugin(ctx, name)
}

func (s *PluginService) GetPluginStatus(name string) map[string]interface{} {
	// 检查进程状态（如果是进程模式）
	running := s.runner.IsPluginRunning(name)

	// 检查gRPC连接状态（如果是gRPC模式）
	grpcStatus := s.manager.GetPluginStatus(name)

	// 合并状态信息
	status := map[string]interface{}{
		"process_running": running,
		"grpc_status":     grpcStatus,
	}

	// 如果有gRPC状态，使用它；否则使用进程状态
	if grpcStatus["status"] == "connected" {
		status["running"] = grpcStatus["running"]
		status["healthy"] = grpcStatus["healthy"]
	} else {
		status["running"] = running
		status["healthy"] = running
	}

	return status
}

// 保持向后兼容
func (s *PluginService) IsPluginRunning(name string) bool {
	status := s.GetPluginStatus(name)
	if running, ok := status["running"].(bool); ok {
		return running
	}
	return false
}

func (s *PluginService) StartPlugin(ctx context.Context, name string) error {
	return s.runner.StartPlugin(ctx, name)
}

func (s *PluginService) StopPlugin(ctx context.Context, name string) error {
	return s.runner.StopPlugin(ctx, name)
}

func (s *PluginService) GetPluginLogs(name string, lines int) []string {
	return s.runner.GetPluginLogs(name, lines)
}