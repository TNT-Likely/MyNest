import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'

export default function SystemConfig() {
  const [pathTemplate, setPathTemplate] = useState('')
  const [aria2Url, setAria2Url] = useState('')
  const [aria2Secret, setAria2Secret] = useState('')
  const [aria2DownloadDir, setAria2DownloadDir] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      const response = await api.get('/system/configs')
      const configs = response.data.configs
      setPathTemplate(configs.download_path_template || '{plugin}/{date}/{filename}')
      setAria2Url(configs.aria2_rpc_url || 'http://localhost:6800/jsonrpc')
      setAria2Secret(configs.aria2_rpc_secret || '')

      // 尝试从下载器获取状态中读取目录
      try {
        const statusResp = await api.get('/downloader/status')
        if (statusResp.data.status?.dir) {
          setAria2DownloadDir(statusResp.data.status.dir)
        }
      } catch (e) {
        console.error('Failed to load aria2 dir:', e)
      }
    } catch (error) {
      console.error('Failed to load configs:', error)
    }
  }

  const handleSave = async (key: string, value: string) => {
    setLoading(true)
    try {
      await api.post('/system/configs', { key, value })
      alert('✅ 配置已保存')
    } catch (error) {
      alert('保存失败，请重试')
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
              placeholder="http://localhost:6800/jsonrpc"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aria2Secret">aria2 RPC 密钥</Label>
            <Input
              id="aria2Secret"
              type="password"
              value={aria2Secret}
              onChange={(e) => setAria2Secret(e.target.value)}
              placeholder="请输入密钥"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aria2DownloadDir">下载目录（只读）</Label>
            <Input
              id="aria2DownloadDir"
              value={aria2DownloadDir || '从 aria2 自动获取'}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              aria2 启动时配置的下载目录，应用会在此目录下创建子目录
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => handleSave('aria2_rpc_url', aria2Url)} disabled={loading}>
              保存 RPC 地址
            </Button>
            <Button onClick={() => handleSave('aria2_rpc_secret', aria2Secret)} disabled={loading}>
              保存 RPC 密钥
            </Button>
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pathTemplate">路径模板</Label>
            <Input
              id="pathTemplate"
              value={pathTemplate}
              onChange={(e) => setPathTemplate(e.target.value)}
              placeholder="{plugin}/{date}/{filename}"
            />
            <p className="text-sm text-muted-foreground">
              示例：<code className="bg-muted px-1 py-0.5 rounded">{pathTemplate}</code> → telegram-bot/2025-09-24/video.mp4
            </p>
          </div>

          <Button onClick={() => handleSave('download_path_template', pathTemplate)} disabled={loading}>
            {loading ? '保存中...' : '保存路径模板'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}