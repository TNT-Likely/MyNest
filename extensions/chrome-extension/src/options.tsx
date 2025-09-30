import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './options.css'

interface Config {
  apiUrl: string
  apiToken: string
  defaultCategory: string
}

interface StatusMessage {
  text: string
  type: 'success' | 'error'
  visible: boolean
}

const Options: React.FC = () => {
  const [config, setConfig] = useState<Config>({
    apiUrl: '',
    apiToken: '',
    defaultCategory: 'browser'
  })
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({
    text: '',
    type: 'success',
    visible: false
  })
  const [testing, setTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    restoreOptions()
  }, [])

  const restoreOptions = () => {
    chrome.storage.sync.get(
      {
        apiUrl: '',
        apiToken: '',
        defaultCategory: 'browser'
      },
      (items) => {
        setConfig(items as Config)
      }
    )
  }

  const saveOptions = (e: React.FormEvent) => {
    e.preventDefault()

    // 验证必填项
    if (!config.apiUrl || !config.apiToken) {
      showStatus('请填写所有必填项', 'error')
      return
    }

    // 验证 URL 格式
    try {
      new URL(config.apiUrl)
    } catch (error) {
      showStatus('API 地址格式不正确', 'error')
      return
    }

    // 保存到 Chrome Storage
    chrome.storage.sync.set(
      {
        apiUrl: config.apiUrl.trim(),
        apiToken: config.apiToken.trim(),
        defaultCategory: config.defaultCategory.trim() || 'browser'
      },
      () => {
        showStatus('✅ 配置已保存，Popup 状态将自动更新', 'success')
      }
    )
  }

  const testConnection = async () => {
    if (!config.apiUrl || !config.apiToken) {
      showStatus('请先填写 API 地址和 Token', 'error')
      return
    }

    setTesting(true)

    try {
      // 清理 URL（移除末尾的斜杠）
      const baseUrl = config.apiUrl.trim().replace(/\/$/, '')

      // 直接测试 API Token 是否有效
      const tokenTestResponse = await fetch(`${baseUrl}/api/v1/verify-token`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiToken}`
        }
      })

      if (tokenTestResponse.status === 401 || tokenTestResponse.status === 403) {
        showStatus('Token 无效或未授权，请检查 API Token 是否正确', 'error')
        return
      }

      if (!tokenTestResponse.ok) {
        showStatus(`连接失败: HTTP ${tokenTestResponse.status}`, 'error')
        return
      }

      const tokenData = await tokenTestResponse.json()
      if (tokenData.valid) {
        showStatus('✅ 连接成功！', 'success')
      } else {
        showStatus('Token 验证失败', 'error')
      }
    } catch (error: any) {
      showStatus(`连接失败: ${error.message}`, 'error')
    } finally {
      setTesting(false)
    }
  }

  const showStatus = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type, visible: true })

    // 3秒后自动隐藏
    setTimeout(() => {
      setStatusMessage((prev) => ({ ...prev, visible: false }))
    }, 3000)
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🪹 MyNest 下载助手</h1>
        <p>配置您的 MyNest 服务连接</p>
      </div>

      <div className="content">
        <form onSubmit={saveOptions}>
          <div className="form-group">
            <label htmlFor="apiUrl">MyNest API 地址 *</label>
            <input
              type="url"
              id="apiUrl"
              placeholder="http://localhost:8080"
              required
              value={config.apiUrl}
              onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            />
            <p className="help-text">
              您的 MyNest 服务地址，例如：http://localhost:8080 或 http://192.168.1.100:8080
              <br />
              也可以填写前端地址（带代理）：http://localhost:3000
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="apiToken">API Token *</label>
            <div className="input-with-icon">
              <input
                type={showToken ? 'text' : 'password'}
                id="apiToken"
                placeholder="输入您的 API Token"
                required
                value={config.apiToken}
                onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowToken(!showToken)}
                title={showToken ? '隐藏 Token' : '显示 Token'}
              >
                {showToken ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <p className="help-text">在 MyNest 管理界面的「系统设置」→「API Token」中创建</p>
          </div>

          <div className="divider"></div>

          <div className="section-title">下载选项</div>

          <div className="form-group">
            <label htmlFor="defaultCategory">默认分类</label>
            <input
              type="text"
              id="defaultCategory"
              placeholder="browser"
              value={config.defaultCategory}
              onChange={(e) => setConfig({ ...config, defaultCategory: e.target.value })}
            />
            <p className="help-text">下载任务的默认分类标签</p>
          </div>

          <div className="button-group">
            <button type="button" className="btn-secondary" onClick={testConnection} disabled={testing}>
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button type="submit" className="btn-primary">
              保存配置
            </button>
          </div>

          {statusMessage.visible && (
            <div className={`status-message ${statusMessage.type}`}>{statusMessage.text}</div>
          )}
        </form>
      </div>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<Options />)