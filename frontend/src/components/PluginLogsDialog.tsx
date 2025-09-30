import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogBody, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plugin } from '@/lib/api'
import { RefreshCw } from 'lucide-react'
import axios from 'axios'

interface PluginLogsDialogProps {
  plugin: Plugin | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PluginLogsDialog({ plugin, open, onOpenChange }: PluginLogsDialogProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const loadLogs = async () => {
    if (!plugin) return

    setLoading(true)
    try {
      const response = await axios.get(`/api/v1/plugins/${plugin.name}/logs?lines=100`)
      if (response.data.success) {
        setLogs(response.data.logs || [])
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && plugin) {
      loadLogs()
      // 每3秒自动刷新
      const interval = setInterval(loadLogs, 3000)
      return () => clearInterval(interval)
    }
  }, [open, plugin])

  if (!plugin) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{plugin.name} - 运行日志</DialogTitle>
              <DialogDescription>
                最近 100 条日志，每 3 秒自动刷新
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        <DialogBody className="min-h-[400px]">
          <div className="bg-black/90 text-green-400 font-mono text-sm p-4 rounded-lg h-full">
            {logs.length === 0 ? (
              <div className="text-gray-500">暂无日志</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap break-all">
                  {log}
                </div>
              ))
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}