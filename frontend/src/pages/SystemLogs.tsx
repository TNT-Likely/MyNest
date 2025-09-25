import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Trash2, RefreshCw, Filter } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface LogEntry {
  id: number
  level: string
  category: string
  message: string
  details?: string
  timestamp: string
  source?: string
}

interface LogStats {
  total_logs: number
  error_count: number
  info_count: number
  debug_count: number
  warn_count: number
  categories: Record<string, number>
}

const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [level, setLevel] = useState<string>('all')
  const [category, setCategory] = useState<string>('all')
  const [lines, setLines] = useState<number>(100)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const getLevelColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'destructive'
      case 'WARN':
        return 'outline'
      case 'INFO':
        return 'secondary'
      case 'DEBUG':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'download':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'plugin':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'system':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        level,
        category,
        lines: lines.toString()
      })

      const response = await api.get(`/system/logs?${params}`)
      setLogs(response.data.logs)
    } catch (error) {
      toast.error('获取日志失败')
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/system/logs/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch log stats:', error)
    }
  }

  const clearLogs = async () => {
    try {
      await api.delete(`/system/logs?category=${category}`)
      toast.success('日志已清空')
      fetchLogs()
      fetchStats()
    } catch (error) {
      toast.error('清空日志失败')
      console.error('Failed to clear logs:', error)
    }
  }

  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [level, category, lines])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchLogs()
      fetchStats()
    }, 3000)

    return () => clearInterval(interval)
  }, [autoRefresh, level, category, lines])

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total_logs}</div>
              <p className="text-sm text-muted-foreground">总日志数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{stats.error_count}</div>
              <p className="text-sm text-muted-foreground">错误</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.warn_count}</div>
              <p className="text-sm text-muted-foreground">警告</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.info_count}</div>
              <p className="text-sm text-muted-foreground">信息</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-600">{stats.debug_count}</div>
              <p className="text-sm text-muted-foreground">调试</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            日志筛选与控制
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">级别:</span>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="ERROR">错误</SelectItem>
                  <SelectItem value="WARN">警告</SelectItem>
                  <SelectItem value="INFO">信息</SelectItem>
                  <SelectItem value="DEBUG">调试</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">分类:</span>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="download">下载</SelectItem>
                  <SelectItem value="plugin">插件</SelectItem>
                  <SelectItem value="system">系统</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">行数:</span>
              <Select value={lines.toString()} onValueChange={(v) => setLines(parseInt(v))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={fetchLogs}
              disabled={loading}
              size="sm"
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>

            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              size="sm"
              variant={autoRefresh ? 'default' : 'outline'}
            >
              {autoRefresh ? '停止自动刷新' : '自动刷新'}
            </Button>

            <Button
              onClick={clearLogs}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              清空日志
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            系统日志
            {logs && logs.length > 0 && (
              <Badge variant="secondary">{logs.length} 条记录</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {!logs || logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {loading ? '正在加载日志...' : '暂无日志记录'}
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant={getLevelColor(log.level)}>
                          {log.level}
                        </Badge>
                        <div className={`px-2 py-1 rounded text-xs ${getCategoryColor(log.category)}`}>
                          {log.category}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{log.message}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>

                        {log.details && (
                          <p className="text-sm text-muted-foreground mt-1 font-mono">
                            {log.details}
                          </p>
                        )}

                        {log.source && (
                          <p className="text-xs text-muted-foreground mt-1">
                            来源: {log.source}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

export default SystemLogs