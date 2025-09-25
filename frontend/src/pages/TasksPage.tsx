import { useEffect, useState } from 'react'
import { Plus, RefreshCw, MoreVertical, Filter, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { tasksApi, Task, TaskQueryParams } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelect, Option } from '@/components/ui/multi-select'
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

  // 分页和筛选状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filters, setFilters] = useState<TaskQueryParams>({
    hide_success: true, // 默认隐藏成功任务
    status: [] // 状态数组
  })
  const [showFilters, setShowFilters] = useState(false)

  // 状态选项
  const statusOptions: Option[] = [
    { value: 'pending', label: '等待中' },
    { value: 'downloading', label: '下载中' },
    { value: 'completed', label: '已归巢' },
    { value: 'failed', label: '失败' },
    { value: 'paused', label: '已暂停' },
  ]

  // 来源插件选项
  const pluginOptions: Option[] = [
    { value: 'telegram-bot', label: 'Telegram Bot' },
    { value: 'web', label: 'Web 直接下载' },
    { value: 'rss', label: 'RSS 订阅' },
    { value: 'youtube', label: 'YouTube' },
  ]

  useEffect(() => {
    loadTasks()

    const interval = setInterval(() => {
      loadTasks()
    }, 3000)

    return () => clearInterval(interval)
  }, [currentPage, pageSize, filters])

  const loadTasks = async () => {
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        ...filters,
      }
      const response = await tasksApi.list(params)
      setTasks(response.data.data || [])
      setTotal(response.data.pagination.total)
      setTotalPages(response.data.pagination.total_pages)
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
      toast.success('✅ 已归巢')
      await loadTasks()
    } catch (error) {
      console.error('Failed to submit download:', error)
      toast.error('提交失败，请重试')
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
      toast.error('重试失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await tasksApi.delete(id)
      await loadTasks()
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast.error('删除失败')
    }
  }

  const handlePause = async (id: number) => {
    try {
      await tasksApi.pause(id)
      await loadTasks()
    } catch (error) {
      console.error('Failed to pause task:', error)
      toast.error('操作失败')
    }
  }

  const handleClearFailed = async () => {
    if (!confirm('确定要清除所有失败的任务吗？此操作不可撤销。')) {
      return
    }

    try {
      const response = await tasksApi.clearFailed()
      toast.success(response.data.message)
      await loadTasks()
      setCurrentPage(1) // 重置到第一页
    } catch (error) {
      console.error('Failed to clear failed tasks:', error)
      toast.error('清理失败')
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleFilterChange = (key: keyof TaskQueryParams, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
    setCurrentPage(1) // 筛选时重置到第一页
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" />
            筛选
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearFailed}>
            <Trash2 className="mr-2 h-4 w-4" />
            清理失败任务
          </Button>
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
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">筛选条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>状态（可多选）</Label>
                <MultiSelect
                  options={statusOptions}
                  value={filters.status || []}
                  onValueChange={(value) => handleFilterChange('status', value.length > 0 ? value : undefined)}
                  placeholder="选择状态..."
                />
              </div>

              <div className="space-y-2">
                <Label>来源插件</Label>
                <Select
                  value={filters.plugin_name || "all"}
                  onValueChange={(value) => handleFilterChange('plugin_name', value === "all" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="全部来源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部来源</SelectItem>
                    {pluginOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>文件名</Label>
                <Input
                  placeholder="搜索文件名"
                  value={filters.filename || ""}
                  onChange={(e) => handleFilterChange('filename', e.target.value || undefined)}
                />
              </div>

              <div className="space-y-2">
                <Label>显示选项</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hide_success"
                    checked={filters.hide_success}
                    onCheckedChange={(checked) => handleFilterChange('hide_success', checked)}
                  />
                  <label htmlFor="hide_success" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    隐藏成功任务
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* 分页控件 */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {total} 个任务，显示第 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, total)} 个
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else {
                  const start = Math.max(1, currentPage - 2);
                  pageNum = start + i;
                  if (pageNum > totalPages) {
                    pageNum = totalPages - (4 - i);
                  }
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
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