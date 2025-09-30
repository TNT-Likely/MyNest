import { useEffect, useState } from 'react'
import { Plus, RefreshCw, MoreVertical, Filter, Trash2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { tasksApi, Task, TaskQueryParams } from '../lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogBody, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { MultiSelect, Option } from '@/components/ui/multi-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TaskProgress from '@/components/TaskProgress'
import TaskDetailDialog from '@/components/TaskDetailDialog'
import DownloaderStatus from '@/components/DownloaderStatus'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Tab 状态
  const [activeTab, setActiveTab] = useState('in-progress')

  // 分页和筛选状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filters, setFilters] = useState<TaskQueryParams>({
    status: [] // 状态数组
  })
  const [searchQuery, setSearchQuery] = useState('')
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
    { value: 'manual', label: '手动添加' },
    { value: 'chrome-extension', label: 'Chrome 插件' },
    { value: 'telegram-bot', label: 'Telegram Bot' },
    { value: 'rss', label: 'RSS 订阅' },
    { value: 'youtube', label: 'YouTube' },
  ]

  // 插件名称映射（用于表格显示）
  const pluginNameMap: Record<string, string> = {
    'manual': '手动',
    'chrome-extension': 'Chrome插件',
    'telegram-bot': 'Telegram Bot',
    'rss': 'RSS',
    'youtube': 'YouTube',
    'web': '手动', // 兼容旧数据
  }

  useEffect(() => {
    loadTasks()

    const interval = setInterval(() => {
      loadTasks()
    }, 3000)

    return () => clearInterval(interval)
  }, [currentPage, pageSize, filters, activeTab, searchQuery])

  const loadTasks = async () => {
    try {
      // 根据当前 tab 设置状态过滤
      const tabFilters = activeTab === 'in-progress'
        ? ['pending', 'downloading', 'paused']
        : activeTab === 'completed'
        ? ['completed']
        : ['failed']

      const params = {
        page: currentPage,
        page_size: pageSize,
        status: tabFilters, // 始终使用 tab 过滤
        plugin_name: filters.plugin_name,
        category: filters.category,
        filename: searchQuery || filters.filename,
      }
      console.log('[DEBUG] Frontend sending params:', params)
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

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    setCurrentPage(1) // 重置到第一页
    setSearchQuery('') // 清空搜索
    setFilters({ status: [] }) // 清空过滤器
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setSubmitting(true)
    try {
      await api.post('/download', {
        url: url.trim(),
        plugin_name: 'manual',
        category: 'manual'
      })
      setUrl('')
      setOpen(false)
      toast.success('✅ 已归巢')
      await loadTasks()
    } catch (error: any) {
      console.error('Failed to submit download:', error)
      const errorMsg = error.response?.data?.error || '提交失败，请重试'
      toast.error(errorMsg)
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
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">下载任务</h2>
          <Button variant="ghost" size="sm" onClick={loadTasks}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DownloaderStatus />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-initial">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">新建任务</span>
                <span className="sm:hidden">新建</span>
              </Button>
            </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
              <DialogHeader>
                <DialogTitle>新建下载任务</DialogTitle>
                <DialogDescription>
                  输入下载链接，支持 HTTP/HTTPS、磁力链接等
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <div className="grid gap-4">
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
              </DialogBody>
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="in-progress" className="flex-1 sm:flex-initial text-xs sm:text-sm">进行中</TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 sm:flex-initial text-xs sm:text-sm">已完成</TabsTrigger>
            <TabsTrigger value="failed" className="flex-1 sm:flex-initial text-xs sm:text-sm">失败</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 sm:flex-initial">
              <Input
                placeholder="搜索任务..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">筛选</span>
            </Button>
            {activeTab === 'completed' && (
              <Button variant="outline" size="sm" onClick={handleClearFailed} className="hidden sm:flex">
                <Trash2 className="mr-2 h-4 w-4" />
                清理失败任务
              </Button>
            )}
          </div>
        </div>

        {/* 筛选面板 */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">筛选条件</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

              </div>
            </CardContent>
          </Card>
        )}

        <TabsContent value="in-progress" className="space-y-4">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 sm:p-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">暂无进行中的任务</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="md:rounded-md md:border">
                <Table>
                  <TableHeader className="hidden md:table-header-group">
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="block space-y-3 md:table-row-group md:space-y-0">
                    {tasks.map((task) => (
                      <TableRow key={task.id} className="flex flex-col border rounded-lg p-4 cursor-pointer hover:bg-muted/50 md:table-row md:border-b md:rounded-none md:p-0" onClick={() => {
                        setSelectedTask(task)
                        setDetailOpen(true)
                      }}>
                        <TableCell className="border-0 p-0 md:p-4">
                          <div className="space-y-2">
                            <div className="break-all text-sm md:text-base md:truncate md:max-w-md font-medium">
                              {task.filename || task.url}
                            </div>
                            <TaskProgress taskId={task.id} status={task.status} />
                          </div>
                        </TableCell>
                        <TableCell className="border-0 p-0 py-2 md:p-4">
                          <div className="flex items-center gap-2 text-xs md:text-sm">
                            {getStatusBadge(task.status)}
                            <span className="text-muted-foreground md:hidden">
                              {pluginNameMap[task.plugin_name] || task.plugin_name || '-'}
                            </span>
                            <span className="text-muted-foreground md:hidden ml-auto">
                              {new Date(task.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell md:p-4">
                          {pluginNameMap[task.plugin_name] || task.plugin_name || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell md:p-4">
                          {new Date(task.created_at).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell className="hidden md:table-cell md:p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
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

              {/* 分页控件 */}
              {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                  <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                    共 {total} 个任务，第 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, total)} 个
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="text-xs sm:text-sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">上一页</span>
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
                            className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
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
                      className="text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">下一页</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                      <SelectTrigger className="w-16 sm:w-20 text-xs sm:text-sm">
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 sm:p-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">暂无已完成的任务</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="md:rounded-md md:border">
                <Table>
                  <TableHeader className="hidden md:table-header-group">
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="block space-y-3 md:table-row-group md:space-y-0">
                    {tasks.map((task) => (
                      <TableRow key={task.id} className="flex flex-col border rounded-lg p-4 cursor-pointer hover:bg-muted/50 md:table-row md:border-b md:rounded-none md:p-0" onClick={() => {
                        setSelectedTask(task)
                        setDetailOpen(true)
                      }}>
                        <TableCell className="border-0 p-0 md:p-4">
                          <div className="break-all text-sm md:text-base md:truncate md:max-w-md font-medium">
                            {task.filename || task.url}
                          </div>
                        </TableCell>
                        <TableCell className="border-0 p-0 py-2 md:p-4">
                          <div className="flex items-center gap-2 text-xs md:text-sm">
                            {getStatusBadge(task.status)}
                            <span className="text-muted-foreground md:hidden">
                              {pluginNameMap[task.plugin_name] || task.plugin_name || '-'}
                            </span>
                            <span className="text-muted-foreground md:hidden ml-auto">
                              {new Date(task.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell md:p-4">
                          {pluginNameMap[task.plugin_name] || task.plugin_name || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell md:p-4">
                          {new Date(task.created_at).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell className="hidden md:table-cell md:p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
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

              {/* 分页控件 */}
              {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                  <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                    共 {total} 个任务，第 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, total)} 个
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="text-xs sm:text-sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">上一页</span>
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
                            className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
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
                      className="text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">下一页</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                      <SelectTrigger className="w-16 sm:w-20 text-xs sm:text-sm">
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="failed" className="space-y-4">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 sm:p-12 text-center">
              <p className="text-sm sm:text-base text-muted-foreground">暂无失败的任务</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="md:rounded-md md:border">
                <Table>
                  <TableHeader className="hidden md:table-header-group">
                    <TableRow>
                      <TableHead>文件名</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>错误信息</TableHead>
                      <TableHead>来源</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-[100px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="block space-y-3 md:table-row-group md:space-y-0">
                    {tasks.map((task) => (
                      <TableRow key={task.id} className="flex flex-col border rounded-lg p-4 cursor-pointer hover:bg-muted/50 md:table-row md:border-b md:rounded-none md:p-0" onClick={() => {
                        setSelectedTask(task)
                        setDetailOpen(true)
                      }}>
                        <TableCell className="border-0 p-0 md:p-4">
                          <div className="break-all text-sm md:text-base md:truncate md:max-w-md font-medium">
                            {task.filename || task.url}
                          </div>
                        </TableCell>
                        <TableCell className="border-0 p-0 py-2 md:p-4">
                          <div className="flex items-center gap-2 text-xs md:text-sm">
                            {getStatusBadge(task.status)}
                            <span className="text-muted-foreground md:hidden">
                              {pluginNameMap[task.plugin_name] || task.plugin_name || '-'}
                            </span>
                            <span className="text-muted-foreground md:hidden ml-auto">
                              {new Date(task.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-destructive text-xs md:text-sm border-0 p-0 py-2 md:p-4">
                          <div className="break-all md:truncate md:max-w-xs">
                            {task.error_msg || '未知错误'}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell md:p-4">
                          {pluginNameMap[task.plugin_name] || task.plugin_name || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell md:p-4">
                          {new Date(task.created_at).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell className="border-0 p-0 pt-2 md:p-4">
                          <div className="flex items-center gap-2 justify-start md:justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRetry(task.id)
                              }}
                              title="重试"
                            >
                              <RotateCcw className="h-4 w-4 md:mr-0" />
                              <span className="md:hidden ml-1">重试</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTask(task)
                                setDetailOpen(true)
                              }}
                              title="详情"
                              className="md:inline-flex hidden"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页控件 */}
              {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                  <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                    共 {total} 个任务，第 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, total)} 个
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="text-xs sm:text-sm"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">上一页</span>
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
                            className="w-7 h-7 sm:w-8 sm:h-8 p-0 text-xs sm:text-sm"
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
                      className="text-xs sm:text-sm"
                    >
                      <span className="hidden sm:inline">下一页</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                      <SelectTrigger className="w-16 sm:w-20 text-xs sm:text-sm">
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
            </div>
          )}
        </TabsContent>
      </Tabs>

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