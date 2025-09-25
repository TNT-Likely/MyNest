import { Task } from '@/lib/api'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

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
  if (!task) return null

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制到剪贴板')
    } catch (error) {
      toast.error('复制失败')
    }
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
                onClick={() => copyToClipboard(task.url)}
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

          {task.plugin_name && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">来源</label>
              <p className="mt-1 text-sm">{task.plugin_name}</p>
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

          <div className="flex justify-end gap-2 pt-4 border-t">
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
              onClick={() => {
                // 简单的替换方案：双击删除或使用更友好的提示
                if (window.confirm('确定要删除这个任务吗？此操作不可撤销。')) {
                  onDelete(task.id)
                  onOpenChange(false)
                  toast.success('任务已删除')
                }
              }}
            >
              删除任务
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}