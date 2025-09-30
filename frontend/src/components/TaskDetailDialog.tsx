import { useEffect, useState } from 'react'
import { Task, tasksApi } from '@/lib/api'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogBody, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, AlertCircle, File, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirm } from '@/lib/confirm'
import { copyToClipboard } from '@/lib/utils'

interface TaskFile {
  path: string
  length: number
}

interface TaskDetailDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetry: (id: number) => void
  onDelete: (id: number) => void
  onPause: (id: number) => void
}

export default function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onRetry,
  onDelete,
  onPause
}: TaskDetailDialogProps) {
  const [files, setFiles] = useState<TaskFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)

  // 插件名称映射
  const pluginNameMap: Record<string, string> = {
    'manual': '手动',
    'chrome-extension': 'Chrome插件',
    'telegram-bot': 'Telegram Bot',
    'rss': 'RSS',
    'youtube': 'YouTube',
    'web': '手动', // 兼容旧数据
  }

  useEffect(() => {
    if (open && task) {
      // 获取文件列表
      setLoadingFiles(true)
      tasksApi.getProgress(task.id)
        .then(response => {
          if (response.data.files && response.data.files.length > 0) {
            setFiles(response.data.files)
          }
        })
        .catch(error => {
          console.error('Failed to fetch files:', error)
        })
        .finally(() => {
          setLoadingFiles(false)
        })
    } else {
      setFiles([])
    }
  }, [open, task])

  if (!task) return null

  const handleCopy = async (text: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    const success = await copyToClipboard(text)
    if (success) {
      toast.success('已复制到剪贴板')
    } else {
      toast.error('复制失败，请手动复制')
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      downloading: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      paused: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>任务详情</DialogTitle>
          <DialogDescription>
            查看任务的详细信息和操作
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">状态</label>
            <div className="mt-1">
              <Badge className={getStatusColor(task.status)}>
                {task.status === 'downloading' ? '下载中' :
                 task.status === 'completed' ? '已归巢' :
                 task.status === 'failed' ? '失败' :
                 task.status === 'paused' ? '已暂停' : '等待中'}
              </Badge>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">下载链接</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted p-2 rounded break-all">
                {task.url}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleCopy(task.url, e)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {task.filename && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">文件名</label>
              <p className="mt-1 text-sm break-all">{task.filename}</p>
            </div>
          )}

          {task.file_path && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">保存路径</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 text-sm bg-muted p-2 rounded break-all">
                  {task.file_path}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => handleCopy(task.file_path || '', e)}
                  title="复制文件路径"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {task.plugin_name && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">来源</label>
              <p className="mt-1 text-sm">{pluginNameMap[task.plugin_name] || task.plugin_name}</p>
            </div>
          )}

          {task.error_msg && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">错误信息</p>
                  <p className="text-sm text-destructive/90 mt-1">{task.error_msg}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-muted-foreground">创建时间</label>
            <p className="mt-1 text-sm">
              {new Date(task.created_at).toLocaleString('zh-CN')}
            </p>
          </div>

          {task.completed_at && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">完成时间</label>
              <p className="mt-1 text-sm">
                {new Date(task.completed_at).toLocaleString('zh-CN')}
              </p>
            </div>
          )}

          {/* 文件列表 */}
          {loadingFiles ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>加载文件列表...</span>
            </div>
          ) : files.length > 0 && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                文件列表 ({files.length} 个文件)
              </label>
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-2 rounded bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <File className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm break-all">{file.path}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(file.length)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleCopy(file.path, e)}
                      className="flex-shrink-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </DialogBody>

        <div className="flex justify-end gap-2 flex-shrink-0 px-6 pb-6 pt-4 border-t">
          {task.status === 'downloading' && (
            <Button
              variant="outline"
              onClick={() => {
                onPause(task.id)
                onOpenChange(false)
              }}
            >
              暂停
            </Button>
          )}
          {task.status === 'paused' && (
            <Button
              onClick={() => {
                onPause(task.id)
                onOpenChange(false)
              }}
            >
              继续下载
            </Button>
          )}
          {task.status === 'failed' && (
            <Button
              onClick={() => {
                onRetry(task.id)
                onOpenChange(false)
              }}
            >
              重试
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={async () => {
              if (!task) return
              const confirmed = await confirm({
                title: '确认删除',
                description: '确定要删除这个任务吗？此操作不可撤销。',
                confirmText: '删除',
                cancelText: '取消',
                variant: 'destructive',
              })
              if (confirmed) {
                onDelete(task.id)
                onOpenChange(false)
                toast.success('任务已删除')
              }
            }}
          >
            删除任务
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}