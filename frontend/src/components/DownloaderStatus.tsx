import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import api from '@/lib/api'

interface DownloaderStatusData {
  connected: boolean
  version?: string
  error?: string
}

export default function DownloaderStatus() {
  const [status, setStatus] = useState<DownloaderStatusData | null>(null)
  const [loading, setLoading] = useState(true)

  const checkStatus = async () => {
    try {
      const response = await api.get('/downloader/status')
      const data = response.data

      setStatus({
        connected: data.connected || false,
        version: data.status?.version,
        error: data.error
      })
    } catch (error: any) {
      console.error('Failed to check downloader status:', error)
      setStatus({
        connected: false,
        error: error.response?.data?.error || '无法连接到下载器'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>检查下载器状态...</span>
      </div>
    )
  }

  if (!status || !status.connected) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          下载器离线
        </Badge>
        {status?.error && (
          <span className="text-xs text-muted-foreground">{status.error}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle className="h-3 w-3" />
        下载器在线
      </Badge>
      {status.version && (
        <span className="text-xs text-muted-foreground">v{status.version}</span>
      )}
    </div>
  )
}