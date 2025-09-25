import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { pluginsApi, Plugin } from '../lib/api'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import PluginConfigDialog from '@/components/PluginConfigDialog'
import PluginLogsDialog from '@/components/PluginLogsDialog'
import { Settings, FileText, RotateCcw } from 'lucide-react'

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)

  useEffect(() => {
    loadPlugins()
  }, [])

  const loadPlugins = async () => {
    try {
      const response = await pluginsApi.list()
      setPlugins(response.data.plugins || [])
    } catch (error) {
      console.error('Failed to load plugins:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (plugin: Plugin) => {
    try {
      if (plugin.enabled) {
        await pluginsApi.disable(plugin.name)
        await loadPlugins()
      } else {
        setSelectedPlugin(plugin)
        setConfigOpen(true)
      }
    } catch (error) {
      console.error('Failed to toggle plugin:', error)
    }
  }

  const handleSaveConfig = async (config: Record<string, string>) => {
    if (!selectedPlugin) return

    try {
      await pluginsApi.enable(selectedPlugin.name, config)
      await loadPlugins()
    } catch (error) {
      console.error('Failed to save config:', error)
      toast.error('配置保存失败')
    }
  }

  const handleStart = async (plugin: Plugin) => {
    try {
      await pluginsApi.start(plugin.name)
      await loadPlugins()
    } catch (error) {
      console.error('Failed to start plugin:', error)
      toast.error('启动失败')
    }
  }

  const handleStop = async (plugin: Plugin) => {
    try {
      await pluginsApi.stop(plugin.name)
      await loadPlugins()
    } catch (error) {
      console.error('Failed to stop plugin:', error)
      toast.error('停止失败')
    }
  }

  const handleRestart = async (plugin: Plugin) => {
    try {
      await pluginsApi.restart(plugin.name)
      await loadPlugins()
      toast.success('重启成功')
    } catch (error) {
      console.error('Failed to restart plugin:', error)
      toast.error('重启失败')
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">插件管理</h2>

      {plugins.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">暂无已安装插件</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <Card key={plugin.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plugin.name}</CardTitle>
                  <div className="flex gap-2">
                    {plugin.running && (
                      <Badge variant="default" className="bg-green-600">
                        运行中
                      </Badge>
                    )}
                    {plugin.enabled && !plugin.running && (
                      <Badge variant="destructive">
                        已停止
                      </Badge>
                    )}
                    {!plugin.enabled && (
                      <Badge variant="secondary">
                        已禁用
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription>
                  版本: {plugin.version || 'unknown'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex gap-2">
                {plugin.enabled && !plugin.running && (
                  <Button
                    onClick={() => handleStart(plugin)}
                    variant="default"
                    className="flex-1"
                  >
                    启动
                  </Button>
                )}
                {plugin.enabled && plugin.running && (
                  <Button
                    onClick={() => handleStop(plugin)}
                    variant="outline"
                    className="flex-1"
                  >
                    停止
                  </Button>
                )}
                {!plugin.enabled && (
                  <Button
                    onClick={() => handleToggle(plugin)}
                    variant="default"
                    className="flex-1"
                  >
                    启用
                  </Button>
                )}
                {plugin.enabled && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedPlugin(plugin)
                        setLogsOpen(true)
                      }}
                      title="查看日志"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedPlugin(plugin)
                        setConfigOpen(true)
                      }}
                      title="配置"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRestart(plugin)}
                      title="重启"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleToggle(plugin)}
                      title="禁用"
                    >
                      禁用
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <PluginConfigDialog
        plugin={selectedPlugin}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSave={handleSaveConfig}
      />

      <PluginLogsDialog
        plugin={selectedPlugin}
        open={logsOpen}
        onOpenChange={setLogsOpen}
      />
    </div>
  )
}