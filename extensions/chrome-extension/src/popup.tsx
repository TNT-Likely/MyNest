import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './popup.css'
import packageJson from '../package.json'

interface Config {
  apiUrl: string
  apiToken: string
  defaultCategory: string
}

interface Status {
  connected: boolean
  text: string
}

interface Task {
  id: number
  url: string
  filename: string
  status: string
  plugin_name: string
  category: string
  created_at: string
  completed_at?: string
  error_msg?: string
}

interface TaskProgress {
  completedLength: string
  totalLength: string
  downloadSpeed: string
  progress: number
}

type TaskTab = 'active' | 'completed' | 'failed'

interface SniffedResource {
  url: string
  type: 'image' | 'video' | 'audio'
  size?: number  // 文件大小（字节）
  width?: number
  height?: number
  alt?: string
}

const Popup: React.FC = () => {
  const [config, setConfig] = useState<Config>({ apiUrl: '', apiToken: '', defaultCategory: 'browser' })
  const [status, setStatus] = useState<Status>({ connected: false, text: '检查中...' })
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskProgresses, setTaskProgresses] = useState<Record<number, TaskProgress>>({})
  const [activeTab, setActiveTab] = useState<TaskTab>('active')
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [sniffedResources, setSniffedResources] = useState<SniffedResource[]>([])
  const [sniffing, setSniffing] = useState(false)
  const [showSniffed, setShowSniffed] = useState(false)
  const [previewResource, setPreviewResource] = useState<SniffedResource | null>(null)
  const [resourceFilters, setResourceFilters] = useState<{
    image: boolean
    video: boolean
    audio: boolean
  }>({ image: true, video: true, audio: true })

  useEffect(() => {
    loadStatus()
    loadTasks()
    loadSniffedResources() // 加载已保存的嗅探结果
    loadResourceFilters() // 加载过滤器状态
    loadShowSniffedState() // 加载展开状态
    autoSniffCurrentPage() // 自动刷新嗅探

    // 监听配置变化，自动刷新状态
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.apiUrl || changes.apiToken) {
        loadStatus()
        loadTasks()
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    // 每 5 秒刷新当前 tab 的任务状态
    const interval = setInterval(() => {
      loadTasks()
    }, 5000)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
      clearInterval(interval)
    }
  }, [activeTab])

  const autoSniffCurrentPage = async () => {
    setSniffing(true)

    // 触发新的嗅探（不先清空，避免闪烁）
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id
        const storageKey = `sniffedResources_${tabId}`

        // 先获取已有资源
        chrome.storage.local.get([storageKey], (storageResult) => {
          const existingResources = storageResult[storageKey] || []

          chrome.tabs.sendMessage(
            tabId,
            { action: 'sniffMediaResources' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('Sniff error:', chrome.runtime.lastError)
                setSniffing(false)
                return
              }

              if (response && response.resources && Array.isArray(response.resources)) {
                // 合并已有资源和新资源（去重）
                const existingUrls = new Set(existingResources.map((r: SniffedResource) => r.url))
                const newResources = response.resources.filter(
                  (r: SniffedResource) => !existingUrls.has(r.url)
                )
                const mergedResources = [...existingResources, ...newResources]

                // 保存合并后的资源到 storage（按 tabId）
                chrome.storage.local.set({
                  [storageKey]: mergedResources
                }, () => {
                  setSniffing(false)
                  // 保存完成后直接显示合并后的资源
                  setSniffedResources(mergedResources)
                })
              } else {
                setSniffing(false)
              }
            }
          )
        })
      } else {
        setSniffing(false)
      }
    })
  }

  const loadSniffedResources = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        setSniffedResources([])
        return
      }

      const tabId = tabs[0].id
      const storageKey = `sniffedResources_${tabId}`

      chrome.storage.local.get([storageKey], (result) => {
        if (result[storageKey] && Array.isArray(result[storageKey])) {
          setSniffedResources(result[storageKey])
        } else {
          setSniffedResources([])
        }
      })
    })
  }

  const handleSniffedResourceDownload = async (url: string) => {
    if (!config.apiUrl || !config.apiToken) {
      if (confirm('请先配置 API 地址和 Token，是否现在配置？')) {
        openSettings()
      }
      return
    }

    try {
      const baseUrl = config.apiUrl.trim().replace(/\/$/, '')
      const response = await fetch(`${baseUrl}/api/v1/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiToken}`
        },
        body: JSON.stringify({
          url: url,
          plugin_name: 'chrome-extension',
          category: config.defaultCategory || 'browser'
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        loadTasks()
      } else {
        alert(`归巢失败\n\n${result.error || '请检查配置'}`)
      }
    } catch (error: any) {
      alert(`归巢失败\n\n${error.message}`)
    }
  }

  const loadStatus = async () => {
    const cfg = await getConfig()
    setConfig(cfg)

    if (cfg.apiUrl && cfg.apiToken) {
      testConnection(cfg.apiUrl, cfg.apiToken)
    } else {
      setStatus({ connected: false, text: '未配置' })
    }
  }

  const loadTasks = async () => {
    const cfg = await getConfig()

    if (!cfg.apiUrl || !cfg.apiToken || loading) {
      return
    }

    setLoading(true)

    try {
      const baseUrl = cfg.apiUrl.trim().replace(/\/$/, '')

      // 根据 activeTab 构建查询参数
      let statusParam = ''
      if (activeTab === 'active') {
        statusParam = '&status=pending&status=active&status=downloading'
      } else if (activeTab === 'completed') {
        statusParam = '&status=completed'
      } else if (activeTab === 'failed') {
        statusParam = '&status=failed'
      }

      // 只加载最新 5 条任务
      const response = await fetch(
        `${baseUrl}/api/v1/tasks?page=1&page_size=5&plugin_name=chrome-extension${statusParam}`,
        {
          headers: {
            Authorization: `Bearer ${cfg.apiToken}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        const taskList = data.tasks || data.data || []
        setTasks(taskList)

        // 对于正在下载的任务，获取进度
        const activeTasks = taskList.filter(
          (task: Task) => task.status === 'active' || task.status === 'downloading'
        )

        for (const task of activeTasks) {
          loadTaskProgress(task.id, baseUrl, cfg.apiToken)
        }
      } else {
        console.error('Failed to load tasks:', response.status)
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTaskProgress = async (taskId: number, baseUrl: string, apiToken: string) => {
    try {
      const response = await fetch(`${baseUrl}/api/v1/tasks/${taskId}/progress`, {
        headers: {
          Authorization: `Bearer ${apiToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.progress) {
          setTaskProgresses((prev) => ({
            ...prev,
            [taskId]: data.progress
          }))
        }
      }
    } catch (error) {
      console.error(`Failed to load progress for task ${taskId}:`, error)
    }
  }

  const getConfig = (): Promise<Config> => {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          apiUrl: '',
          apiToken: '',
          defaultCategory: 'browser'
        },
        (items) => {
          resolve(items as Config)
        }
      )
    })
  }

  const testConnection = async (apiUrl: string, apiToken: string) => {
    try {
      const baseUrl = apiUrl.trim().replace(/\/$/, '')

      // 直接测试 token 验证端点
      const response = await fetch(`${baseUrl}/api/v1/verify-token`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.valid) {
          setStatus({ connected: true, text: '已连接' })
        } else {
          setStatus({ connected: false, text: 'Token 无效' })
        }
      } else if (response.status === 401 || response.status === 403) {
        setStatus({ connected: false, text: 'Token 无效' })
      } else {
        setStatus({ connected: false, text: '连接失败' })
      }
    } catch (error) {
      setStatus({ connected: false, text: '连接失败' })
    }
  }

  const openSettings = () => {
    chrome.runtime.openOptionsPage()
  }

  const handleManualDownload = async () => {
    const url = downloadUrl.trim()

    if (!url) {
      alert('请输入下载链接')
      return
    }

    // 验证 URL 格式
    try {
      const urlObj = new URL(url)
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        alert('请输入有效的 HTTP/HTTPS 链接')
        return
      }
    } catch (error) {
      alert('链接格式不正确，请输入有效的 HTTP/HTTPS 链接')
      return
    }

    if (!config.apiUrl || !config.apiToken) {
      if (confirm('请先配置 API 地址和 Token，是否现在配置？')) {
        openSettings()
      }
      return
    }

    setDownloading(true)

    try {
      const baseUrl = config.apiUrl.trim().replace(/\/$/, '')
      const response = await fetch(`${baseUrl}/api/v1/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiToken}`
        },
        body: JSON.stringify({
          url: url,
          plugin_name: 'chrome-extension',
          category: config.defaultCategory || 'browser'
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // 清空输入框
        setDownloadUrl('')
        // 刷新任务列表
        loadTasks()
      } else {
        alert(`归巢失败\n\n${result.error || '请检查配置'}`)
      }
    } catch (error: any) {
      alert(`归巢失败\n\n${error.message}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleManualDownload()
    }
  }

  const getDisplayUrl = () => {
    if (!config.apiUrl) return '未配置'
    try {
      const url = new URL(config.apiUrl)
      return url.host
    } catch {
      return config.apiUrl
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      pending: { text: '等待中', className: 'status-pending' },
      active: { text: '下载中', className: 'status-active' },
      downloading: { text: '下载中', className: 'status-active' },
      completed: { text: '已完成', className: 'status-completed' },
      failed: { text: '失败', className: 'status-failed' },
      paused: { text: '已暂停', className: 'status-paused' }
    }
    return statusMap[status] || { text: status, className: 'status-unknown' }
  }

  const formatFileSize = (bytes: string) => {
    const num = parseInt(bytes)
    if (isNaN(num)) return ''
    if (num < 1024) return `${num} B`
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`
    if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`
    return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const formatSpeed = (bytesPerSec: string) => {
    return formatFileSize(bytesPerSec) + '/s'
  }

  const formatFileSizeFromBytes = (bytes?: number) => {
    if (!bytes) return '未知'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const getTaskDisplayName = (task: Task) => {
    if (task.filename) {
      return task.filename
    }

    try {
      const url = new URL(task.url)
      const pathName = url.pathname.split('/').pop()
      return pathName || task.url
    } catch (error) {
      // 如果 URL 解析失败，返回原始 URL
      return task.url
    }
  }

  const loadResourceFilters = () => {
    chrome.storage.local.get(['resourceFilters'], (result) => {
      if (result.resourceFilters) {
        setResourceFilters(result.resourceFilters)
      }
    })
  }

  const loadShowSniffedState = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return

      const tabId = tabs[0].id
      const storageKey = `showSniffed_${tabId}`

      chrome.storage.local.get([storageKey], (result) => {
        if (typeof result[storageKey] === 'boolean') {
          setShowSniffed(result[storageKey])
        }
      })
    })
  }

  const toggleShowSniffed = () => {
    const newState = !showSniffed
    setShowSniffed(newState)

    // 保存展开状态（按 tabId）
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const storageKey = `showSniffed_${tabs[0].id}`
        chrome.storage.local.set({ [storageKey]: newState })
      }
    })
  }

  const clearSniffedResources = () => {
    if (!confirm('确定要清空当前页面的嗅探资源吗？')) {
      return
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const storageKey = `sniffedResources_${tabs[0].id}`
        chrome.storage.local.remove([storageKey], () => {
          setSniffedResources([])
        })
      }
    })
  }

  const toggleResourceFilter = (type: 'image' | 'video' | 'audio') => {
    const newFilters = {
      ...resourceFilters,
      [type]: !resourceFilters[type]
    }
    setResourceFilters(newFilters)
    // 保存过滤器状态
    chrome.storage.local.set({ resourceFilters: newFilters })
  }

  const filteredResources = sniffedResources.filter(resource => resourceFilters[resource.type])

  return (
    <div className="popup-container">
      <div className="header">
        <h1>🪹 MyNest</h1>
        <p>链接的归巢</p>
      </div>

      <div className="content">
        <div className="status-card">
          <div className="status-row">
            <span className="status-label">连接状态</span>
            <span className="status-value">
              <span className={`status-indicator ${status.connected ? 'connected' : 'disconnected'}`}></span>
              <span>{status.text}</span>
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">API 地址</span>
            <span className="status-value">{getDisplayUrl()}</span>
          </div>
        </div>

        {/* 嗅探资源模块 */}
        <div className="sniffed-section">
          <div className="sniffed-header">
            <div className="sniffed-header-left" onClick={toggleShowSniffed}>
              <span className="sniffed-title">
                🔍 页面资源 {sniffedResources.length > 0 && `(${sniffedResources.length})`}
              </span>
              {sniffedResources.length > 0 && (
                <span className="sniffed-toggle">{showSniffed ? '▼' : '▶'}</span>
              )}
            </div>
            <div className="sniffed-actions">
              <button
                className="sniffed-refresh-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  autoSniffCurrentPage()
                }}
                disabled={sniffing}
                title="刷新嗅探"
              >
                {sniffing ? '⏳' : '🔄'}
              </button>
              {sniffedResources.length > 0 && (
                <button
                  className="sniffed-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearSniffedResources()
                  }}
                  title="清空资源"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
          {sniffedResources.length > 0 && showSniffed && (
            <>
              <div className="sniffed-filters">
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={resourceFilters.image}
                    onChange={() => toggleResourceFilter('image')}
                  />
                  <span>图片 ({sniffedResources.filter(r => r.type === 'image').length})</span>
                </label>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={resourceFilters.video}
                    onChange={() => toggleResourceFilter('video')}
                  />
                  <span>视频 ({sniffedResources.filter(r => r.type === 'video').length})</span>
                </label>
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={resourceFilters.audio}
                    onChange={() => toggleResourceFilter('audio')}
                  />
                  <span>音频 ({sniffedResources.filter(r => r.type === 'audio').length})</span>
                </label>
              </div>
              <div className="sniffed-resources">
                {filteredResources.map((resource, index) => (
                  <div
                    key={index}
                    className="sniffed-item"
                    onClick={() => setPreviewResource(resource)}
                  >
                    <div className="sniffed-preview">
                      {resource.type === 'image' && (
                        <img src={resource.url} alt={resource.alt || 'Image'} loading="lazy" />
                      )}
                      {resource.type === 'video' && <span className="resource-icon">🎬</span>}
                      {resource.type === 'audio' && <span className="resource-icon">🎵</span>}
                    </div>
                    <div className="sniffed-info">
                      <div className="sniffed-meta">
                        <span className="resource-type">{resource.type}</span>
                        <span className="resource-size">{formatFileSizeFromBytes(resource.size)}</span>
                      </div>
                      <button
                        className="sniffed-download-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSniffedResourceDownload(resource.url)
                        }}
                        title="下载到 MyNest"
                      >
                        ⬇️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="tasks-section">
          <div className="tabs-header">
            <button
              className={`tab-button ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              进行中
            </button>
            <button
              className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              已完成
            </button>
            <button
              className={`tab-button ${activeTab === 'failed' ? 'active' : ''}`}
              onClick={() => setActiveTab('failed')}
            >
              失败
            </button>
          </div>

          {tasks.length > 0 ? (
            <div className="tasks-list">
              {tasks.map((task) => (
                <div key={task.id} className="task-item">
                  <div className="task-header">
                    <span className="task-filename" title={task.filename || task.url}>
                      {getTaskDisplayName(task)}
                    </span>
                    <span className={`task-status-badge ${getStatusBadge(task.status).className}`}>
                      {getStatusBadge(task.status).text}
                    </span>
                  </div>
                  {taskProgresses[task.id] && (task.status === 'active' || task.status === 'downloading') && (
                    <div className="task-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${taskProgresses[task.id].progress || 0}%` }}
                        ></div>
                      </div>
                      <div className="progress-info">
                        <span className="progress-percent">{taskProgresses[task.id].progress?.toFixed(1)}%</span>
                        <span className="progress-speed">{formatSpeed(taskProgresses[task.id].downloadSpeed)}</span>
                        <span className="progress-size">
                          {formatFileSize(taskProgresses[task.id].completedLength)} /{' '}
                          {formatFileSize(taskProgresses[task.id].totalLength)}
                        </span>
                      </div>
                    </div>
                  )}
                  {task.error_msg && <div className="task-error">{task.error_msg}</div>}
                </div>
              ))}
              <div className="view-more">
                {config.apiUrl && (
                  <a className="view-more-link" href={config.apiUrl} target="_blank" rel="noopener noreferrer">
                    查看更多任务 →
                  </a>
                )}
              </div>
            </div>
          ) : loading ? (
            <div className="empty-state">加载中...</div>
          ) : (
            <div className="empty-state">暂无任务</div>
          )}
        </div>

        <div className="download-input-section">
          <div className="input-group">
            <input
              type="text"
              className="download-input"
              placeholder="输入下载链接..."
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={downloading}
            />
            <button
              className="download-submit-btn"
              onClick={handleManualDownload}
              disabled={downloading || !downloadUrl.trim()}
            >
              {downloading ? '添加中...' : '下载'}
            </button>
          </div>
        </div>

        <div className="quick-actions">
          <button className="action-btn btn-secondary" onClick={openSettings}>
            打开设置
          </button>
          {config.apiUrl && (
            <a className="action-btn btn-secondary" href={config.apiUrl} target="_blank" rel="noopener noreferrer">
              打开 MyNest 面板
            </a>
          )}
        </div>
      </div>

      <div className="footer">MyNest v{packageJson.version} · 右键链接即可下载</div>

      {/* 预览对话框 */}
      {previewResource && (
        <div className="preview-overlay" onClick={() => setPreviewResource(null)}>
          <div className="preview-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <div className="preview-info">
                <span className="preview-type-badge">{previewResource.type}</span>
                <span className="preview-size">{formatFileSizeFromBytes(previewResource.size)}</span>
                {previewResource.width && previewResource.height && (
                  <span className="preview-dimensions">
                    {previewResource.width} × {previewResource.height}
                  </span>
                )}
              </div>
              <button className="preview-close" onClick={() => setPreviewResource(null)}>
                ✕
              </button>
            </div>
            <div className="preview-content">
              {previewResource.type === 'image' && (
                <img src={previewResource.url} alt={previewResource.alt || 'Preview'} />
              )}
              {previewResource.type === 'video' && (
                <video src={previewResource.url} controls autoPlay loop />
              )}
              {previewResource.type === 'audio' && (
                <audio src={previewResource.url} controls autoPlay />
              )}
            </div>
            <div className="preview-actions">
              <a
                className="preview-btn preview-btn-secondary"
                href={previewResource.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                在新标签页打开
              </a>
              <button
                className="preview-btn preview-btn-primary"
                onClick={() => {
                  handleSniffedResourceDownload(previewResource.url)
                  setPreviewResource(null)
                }}
              >
                下载到 MyNest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Popup />)