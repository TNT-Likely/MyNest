// MyNest Chrome Extension - Background Script

interface Config {
  apiUrl: string
  apiToken: string
  defaultCategory: string
}

interface DownloadResponse {
  success: boolean
  error?: string
}

interface HealthResponse {
  name?: string
}

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'download-to-mynest',
    title: '添加到 MyNest 下载',
    contexts: ['link', 'video', 'audio', 'image']
  })

  chrome.contextMenus.create({
    id: 'download-selection-to-mynest',
    title: '下载选中的链接到 MyNest',
    contexts: ['selection']
  })

  chrome.contextMenus.create({
    id: 'sniff-page-media',
    title: '🔍 嗅探页面媒体资源',
    contexts: ['page', 'link', 'image', 'video', 'audio']
  })
})

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'download-to-mynest') {
    // 智能识别：优先下载媒体资源（图片/视频/音频），否则下载链接
    const url = info.srcUrl || info.linkUrl
    if (url) {
      handleDownload(url)
    }
  } else if (info.menuItemId === 'sniff-page-media') {
    // 嗅探页面媒体资源
    if (tab && tab.id) {
      sniffPageMedia(tab.id)
    }
  } else if (info.menuItemId === 'download-selection-to-mynest') {
    if (info.selectionText) {
      // 提取选中文本中的 URL
      const selectedText = info.selectionText.trim()
      const urls = extractUrls(selectedText)

      if (urls.length > 0) {
        // 如果找到多个 URL，下载第一个
        handleDownload(urls[0])

        if (urls.length > 1) {
          showNotification(
            '检测到多个链接',
            `找到 ${urls.length} 个链接，正在下载第一个`,
            'success'
          )
        }
      } else {
        // 尝试将整个文本作为 URL
        if (isValidUrl(selectedText)) {
          handleDownload(selectedText)
        } else {
          showNotification(
            '未找到有效链接',
            '选中的文本中没有包含有效的 HTTP/HTTPS 链接',
            'error'
          )
        }
      }
    }
  }
})

// 验证 URL 是否有效
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    // 只接受 http 和 https 协议
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (error) {
    return false
  }
}

// 提取文本中的 URL
function extractUrls(text: string): string[] {
  // URL 正则表达式
  const urlRegex = /(https?:\/\/[^\s]+)/gi
  const matches = text.match(urlRegex)
  if (!matches) return []

  // 过滤出有效的 URL
  return matches.filter(url => isValidUrl(url))
}

// 处理下载请求
async function handleDownload(url: string): Promise<void> {
  try {
    // 验证 URL
    if (!url || !isValidUrl(url)) {
      showNotification('链接无效', '请提供有效的 HTTP/HTTPS 链接', 'error')
      return
    }

    // 获取配置
    const config = await getConfig()

    if (!config.apiUrl || !config.apiToken) {
      showNotification('配置错误', '请先在扩展选项中配置 API 地址和 Token', 'error')
      return
    }

    // 调用 MyNest API
    const response = await fetch(`${config.apiUrl}/api/v1/download`, {
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

    const result: DownloadResponse = await response.json()

    if (response.ok && result.success) {
      // 提取文件名或显示简短的 URL
      let displayName = url
      try {
        const urlObj = new URL(url)
        const pathName = urlObj.pathname.split('/').pop()
        if (pathName) {
          displayName = pathName.length > 50 ? pathName.substring(0, 50) + '...' : pathName
        }
      } catch (e) {
        // 使用原始 URL 的简短版本
        displayName = url.length > 60 ? url.substring(0, 60) + '...' : url
      }

      showNotification(
        '✅ 已归巢',
        `下载任务已添加\n\n${displayName}\n\n可在扩展弹窗中查看进度`,
        'success'
      )
    } else {
      showNotification('❌ 归巢失败', result.error || '请检查 API 配置或网络连接', 'error')
    }
  } catch (error) {
    console.error('Download error:', error)
    showNotification('❌ 归巢失败', `错误: ${error instanceof Error ? error.message : String(error)}`, 'error')
  }
}

// 获取配置
async function getConfig(): Promise<Config> {
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

// 显示通知
function showNotification(title: string, message: string, type: 'success' | 'error'): void {
  const iconPath = type === 'success' ? 'icons/icon48.png' : 'icons/icon48.png'

  console.log('showNotification function called with:', { title, message, type })

  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconPath,
    title: title,
    message: message,
    priority: 2
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('Notification error:', chrome.runtime.lastError)
    } else {
      console.log('Notification created with ID:', notificationId)
    }
  })
}

// 监听来自 popup 的测试连接请求
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'testConnection') {
    testConnection(request.apiUrl, request.apiToken)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true // 保持消息通道开放
  }
})

// 嗅探页面媒体资源
function sniffPageMedia(tabId: number): void {
  console.log('Starting media sniffing for tab:', tabId)

  // 发送消息给 content script 嗅探资源（content script 已通过 manifest 自动注入）
  chrome.tabs.sendMessage(tabId, { action: 'sniffMediaResources' }, async (response) => {
    if (chrome.runtime.lastError) {
      console.error('Content script error:', chrome.runtime.lastError)
      showNotification('❌ 嗅探失败', '此页面无法嗅探（可能是特殊页面），请刷新后重试', 'error')
      return
    }

    console.log('Received response from content script:', response)

    if (response && response.resources && Array.isArray(response.resources)) {
      const resources = response.resources
      console.log('Found', resources.length, 'resources')

      if (resources.length === 0) {
        showNotification('未找到资源', '当前页面没有检测到媒体资源', 'error')
        return
      }

      // 资源已经在 content script 中按大小排序了
      // 显示资源数量提示
      const images = resources.filter((r: any) => r.type === 'image').length
      const videos = resources.filter((r: any) => r.type === 'video').length
      const audios = resources.filter((r: any) => r.type === 'audio').length

      let message = `找到 ${resources.length} 个资源：\n`
      if (images > 0) message += `图片 ${images} 个\n`
      if (videos > 0) message += `视频 ${videos} 个\n`
      if (audios > 0) message += `音频 ${audios} 个\n\n点击扩展图标查看详情`

      console.log('Calling showNotification with:', message)
      showNotification(
        '🔍 资源嗅探完成',
        message,
        'success'
      )
      console.log('showNotification called')

      // 保存资源到 storage，供 popup 展示（按 tabId）
      const storageKey = `sniffedResources_${tabId}`
      chrome.storage.local.set({
        [storageKey]: resources
      })
    } else {
      console.error('Invalid response:', response)
      showNotification('❌ 嗅探失败', '未收到有效响应', 'error')
    }
  })
}

// 测试 API 连接
async function testConnection(apiUrl: string, apiToken: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${apiUrl}/health`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    })

    if (response.ok) {
      const data: HealthResponse = await response.json()
      return {
        success: true,
        message: `连接成功！服务: ${data.name || 'MyNest'}`
      }
    } else {
      return {
        success: false,
        error: `服务返回错误: ${response.status}`
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `连接失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}