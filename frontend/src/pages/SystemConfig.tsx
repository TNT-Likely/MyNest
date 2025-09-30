import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'
import api from '@/lib/api'

export default function SystemConfig() {
  const [pathTemplate, setPathTemplate] = useState('')
  const [manualDownloadPath, setManualDownloadPath] = useState('')
  const [chromeExtensionPath, setChromeExtensionPath] = useState('')
  const [aria2Url, setAria2Url] = useState('')
  const [aria2Secret, setAria2Secret] = useState('')
  const [aria2DownloadDir, setAria2DownloadDir] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const response = await api.get('/system/configs')
      const configs = response.data.configs
      setPathTemplate(configs.download_path_template || '{plugin}/{date}/{filename}')
      setManualDownloadPath(configs.manual_download_path || 'manual/{filename}')
      setChromeExtensionPath(configs.chrome_extension_path || 'chrome/{filename}')
      setAria2Url(configs.aria2_rpc_url || 'http://aria2:6800/jsonrpc')
      setAria2Secret(configs.aria2_rpc_secret || '')
      setAria2DownloadDir(configs.aria2_download_dir || '/downloads')

    } catch (error) {
      console.error('Failed to load configs:', error)
    }
  }

  const handleSaveAll = async () => {
    setLoading(true)
    try {
      // 保存所有配置
      await Promise.all([
        api.post('/system/configs', { key: 'aria2_rpc_url', value: aria2Url }),
        api.post('/system/configs', { key: 'aria2_rpc_secret', value: aria2Secret }),
        api.post('/system/configs', { key: 'manual_download_path', value: manualDownloadPath }),
        api.post('/system/configs', { key: 'chrome_extension_path', value: chromeExtensionPath }),
        api.post('/system/configs', { key: 'download_path_template', value: pathTemplate }),
      ])
      toast.success('✅ 所有配置已保存')
    } catch (error) {
      toast.error('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold mb-8">系统配置</h1>

      <Card>
        <CardHeader>
          <CardTitle>下载器配置</CardTitle>
          <CardDescription>
            配置 aria2 下载器连接信息
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aria2Url">aria2 RPC 地址</Label>
            <Input
              id="aria2Url"
              value={aria2Url}
              onChange={(e) => setAria2Url(e.target.value)}
              placeholder="http://aria2:6800/jsonrpc"
            />
            <p className="text-sm text-muted-foreground">
              Docker 环境使用服务名: <code className="bg-muted px-1 py-0.5 rounded">http://aria2:6800/jsonrpc</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aria2Secret">aria2 RPC 密钥</Label>
            <div className="relative">
              <Input
                id="aria2Secret"
                type={showSecret ? "text" : "password"}
                value={aria2Secret}
                onChange={(e) => setAria2Secret(e.target.value)}
                placeholder="请输入密钥"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aria2DownloadDir">aria2 下载目录</Label>
            <Input
              id="aria2DownloadDir"
              value={aria2DownloadDir || '/downloads'}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              aria2 的基础下载目录（容器内路径），MyNest 会在此目录下创建子目录
            </p>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>下载路径配置</CardTitle>
          <CardDescription>
            配置文件下载路径模板，支持以下变量：
            <ul className="mt-2 space-y-1 text-sm">
              <li><code className="bg-muted px-1 py-0.5 rounded">{'{plugin}'}</code> - 插件名称</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{'{date}'}</code> - 下载日期 (YYYY-MM-DD)</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{'{datetime}'}</code> - 下载日期时间 (YYYY-MM-DD_HH-MM-SS)</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{'{filename}'}</code> - 文件名</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">{'{random}'}</code> - 随机字符串 (8位十六进制)</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="manualDownloadPath">手动下载路径</Label>
            <Input
              id="manualDownloadPath"
              value={manualDownloadPath}
              onChange={(e) => setManualDownloadPath(e.target.value)}
              placeholder="manual/{filename}"
            />
            <p className="text-sm text-muted-foreground">
              从 Web 界面手动添加的任务保存路径
            </p>
            <p className="text-sm text-muted-foreground">
              示例：<code className="bg-muted px-1 py-0.5 rounded">{manualDownloadPath}</code> → manual/video.mp4
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chromeExtensionPath">Chrome 插件下载路径</Label>
            <Input
              id="chromeExtensionPath"
              value={chromeExtensionPath}
              onChange={(e) => setChromeExtensionPath(e.target.value)}
              placeholder="chrome/{filename}"
            />
            <p className="text-sm text-muted-foreground">
              通过 Chrome 插件添加的任务保存路径
            </p>
            <p className="text-sm text-muted-foreground">
              示例：<code className="bg-muted px-1 py-0.5 rounded">{chromeExtensionPath}</code> → chrome/video.mp4
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pathTemplate">其他插件默认路径模板</Label>
            <Input
              id="pathTemplate"
              value={pathTemplate}
              onChange={(e) => setPathTemplate(e.target.value)}
              placeholder="{plugin}/{date}/{filename}"
            />
            <p className="text-sm text-muted-foreground">
              Telegram Bot、RSS 等插件使用此模板（各插件可在插件配置页单独设置）
            </p>
            <p className="text-sm text-muted-foreground">
              示例：<code className="bg-muted px-1 py-0.5 rounded">{pathTemplate}</code> → telegram-bot/2025-09-30/video.mp4
            </p>
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveAll} disabled={loading} size="lg">
          {loading ? '保存中...' : '保存所有配置'}
        </Button>
      </div>
    </div>
  )
}