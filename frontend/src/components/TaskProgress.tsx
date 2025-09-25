import { useEffect, useState } from 'react'
import { tasksApi, TaskProgress as TaskProgressType } from '@/lib/api'
import { Progress } from '@/components/ui/progress'

interface TaskProgressProps {
  taskId: number
  status: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + '/s'
}

export default function TaskProgress({ taskId, status }: TaskProgressProps) {
  const [progress, setProgress] = useState<TaskProgressType | null>(null)

  useEffect(() => {
    if (status === 'downloading' || status === 'pending') {
      const fetchProgress = async () => {
        try {
          const response = await tasksApi.getProgress(taskId)
          setProgress(response.data.progress)
        } catch (error) {
          console.error('Failed to fetch progress:', error)
        }
      }

      fetchProgress()
      const interval = setInterval(fetchProgress, 2000)
      return () => clearInterval(interval)
    }
  }, [taskId, status])

  if (!progress || status === 'completed' || status === 'failed') {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{Math.round(progress.progress)}%</span>
        <div className="flex items-center gap-2">
          <span>{formatBytes(progress.completed_length)} / {formatBytes(progress.total_length)}</span>
          {progress.download_speed > 0 && (
            <span className="text-primary">↓ {formatSpeed(progress.download_speed)}</span>
          )}
        </div>
      </div>
      <Progress value={progress.progress} className="h-2" />
    </div>
  )
}