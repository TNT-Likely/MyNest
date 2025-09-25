import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Eye, EyeOff } from 'lucide-react'
import { Plugin } from '@/lib/api'

interface PluginConfigDialogProps {
  plugin: Plugin | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: Record<string, string>) => void
}

const PLUGIN_CONFIGS: Record<string, Array<{ key: string; label: string; type: string; required?: boolean; description?: string }>> = {
  'telegram-bot': [
    { key: 'bot_token', label: 'Bot Token', type: 'password', required: true },
    { key: 'allowed_user_ids', label: '允许的用户ID (逗号分隔)', type: 'text' },
    { key: 'core_api_url', label: 'Core API URL', type: 'text' },
    {
      key: 'parse_forwarded_msg',
      label: '解析转发消息',
      type: 'switch',
      description: '自动从转发的消息中提取链接（默认开启）'
    },
    {
      key: 'parse_forwarded_comment',
      label: '解析转发消息评论',
      type: 'switch',
      description: '解析转发时添加的评论中的链接（默认开启）'
    },
    {
      key: 'download_media',
      label: '下载媒体文件',
      type: 'switch',
      description: '自动下载图片等媒体文件（默认开启）'
    },
  ],
}

export default function PluginConfigDialog({ plugin, open, onOpenChange, onSave }: PluginConfigDialogProps) {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  // 当对话框打开时，加载已保存的配置
  useEffect(() => {
    if (open && plugin?.config) {
      setConfig(plugin.config as Record<string, string>)
    } else if (!open) {
      setConfig({})
    }
  }, [open, plugin])

  if (!plugin) return null

  const fields = PLUGIN_CONFIGS[plugin.name] || []

  const handleSave = () => {
    onSave(config)
    setConfig({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>配置 {plugin.name}</DialogTitle>
          <DialogDescription>
            配置插件参数后启用
            {plugin.name === 'telegram-bot' && (
              <a
                href="https://github.com/anthropics/claude-code/blob/main/docs/Telegram插件配置指南.md"
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-primary underline text-sm"
              >
                📖 查看详细配置指南
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {plugin.name === 'telegram-bot' && (
            <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
              <p className="font-medium">快速配置步骤：</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>在 Telegram 搜索 <code className="bg-background px-1 rounded">@BotFather</code></li>
                <li>发送 <code className="bg-background px-1 rounded">/newbot</code> 创建 Bot</li>
                <li>复制获得的 Token 填入下方</li>
                <li>搜索 <code className="bg-background px-1 rounded">@userinfobot</code> 获取你的用户 ID</li>
              </ol>
            </div>
          )}

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">此插件无需配置</p>
          ) : (
            fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.type === 'switch' ? (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={field.key}
                      checked={config[field.key] === 'true' || config[field.key] === undefined}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, [field.key]: checked ? 'true' : 'false' })
                      }
                    />
                    {field.description && (
                      <span className="text-sm text-muted-foreground">{field.description}</span>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      id={field.key}
                      type={field.type === 'password' && showPasswords[field.key] ? 'text' : field.type}
                      value={config[field.key] || ''}
                      onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                      placeholder={field.label}
                    />
                    {field.type === 'password' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPasswords(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                      >
                        {showPasswords[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存并启用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}