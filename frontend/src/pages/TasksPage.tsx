import { useEffect, useState } from 'react'
import { Plus, RefreshCw, MoreVertical } from 'lucide-react'
import { tasksApi, Task } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import TaskProgress from '@/components/TaskProgress'
import TaskDetailDialog from '@/components/TaskDetailDialog'
import DownloaderStatus from '@/components/DownloaderStatus'
import axios from 'axios'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    loadTasks()

    const interval = setInterval(() => {
      loadTasks()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const loadTasks = async () => {
    try {
      const response = await tasksApi.list()
      setTasks(response.data.tasks || [])
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setSubmitting(true)
    try {
      await axios.post('/api/v1/download', {
        url: url.trim(),
        plugin: 'web',
      })
      setUrl('')
      setOpen(false)
      await loadTasks()
    } catch (error) {
      console.error('Failed to submit download:', error)
      alert('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = async (id: number) => {
    try {
      await tasksApi.retry(id)
      await loadTasks()
    } catch (error) {
      console.error('Failed to retry task:', error)
      alert('重试失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await tasksApi.delete(id)
      await loadTasks()
    } catch (error) {
      console.error('Failed to delete task:', error)
      alert('删除失败')
    }
  }

  const handlePause = async (id: number) => {
    try {
      await tasksApi.pause(id)
      await loadTasks()
    } catch (error) {
      console.error('Failed to pause task:', error)
      alert('操作失败')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      downloading: 'default',
      completed: 'default',
      failed: 'destructive',
    }

    const labels: Record<string, string> = {
      pending: '等待中',
      downloading: '下载中',
      completed: '已归巢',
      failed: '失败',
    }

    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    )
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-3xl font-bold tracking-tight">下载任务</h2>
          <Button variant="ghost" size="sm" onClick={loadTasks}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DownloaderStatus />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新建任务
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>新建下载任务</DialogTitle>
                <DialogDescription>
                  输入下载链接，支持 HTTP/HTTPS、磁力链接等
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="url">下载链接</Label>
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/file.zip"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? '提交中...' : '开始下载'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">暂无下载任务</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div className="truncate max-w-md cursor-pointer hover:text-primary"
                           onClick={() => {
                             setSelectedTask(task)
                             setDetailOpen(true)
                           }}>
                        {task.filename || task.url.substring(0, 50) + '...'}
                      </div>
                      <TaskProgress taskId={task.id} status={task.status} />
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.plugin_name || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(task.created_at).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task)
                        setDetailOpen(true)
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailDialog
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRetry={handleRetry}
        onDelete={handleDelete}
        onPause={handlePause}
      />
    </div>
  )
}