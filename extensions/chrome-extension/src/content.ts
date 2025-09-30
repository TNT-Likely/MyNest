// MyNest Chrome Extension - Content Script
// 用于嗅探页面中的媒体资源

import { MediaResource } from './sniffers'
import { sniffStrategies } from './sniffers/strategies'

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request)

  if (request.action === 'sniffMediaResources') {
    try {
      sniffPageMediaAsync().then(resources => {
        console.log('Sniffed resources:', resources)
        console.log('Sending response back...')
        sendResponse({ resources })
        console.log('Response sent successfully')
      }).catch(error => {
        console.error('Error sniffing media:', error)
        sendResponse({ resources: [], error: String(error) })
      })
    } catch (error) {
      console.error('Error sniffing media:', error)
      sendResponse({ resources: [], error: String(error) })
    }
  }
  return true // 保持消息通道开放
})

// 异步嗅探页面中的所有媒体资源（带文件大小）
async function sniffPageMediaAsync(): Promise<MediaResource[]> {
  const resources = sniffPageMedia()

  // 获取文件大小
  const resourcesWithSize = await Promise.all(
    resources.map(async (resource) => {
      const size = await getResourceSize(resource.url)
      return { ...resource, size }
    })
  )

  // 按文件大小排序（从大到小）
  return resourcesWithSize.sort((a, b) => (b.size || 0) - (a.size || 0))
}

// 获取资源文件大小
async function getResourceSize(url: string): Promise<number> {
  try {
    // 方法1：使用 Performance API 获取已加载资源的大小
    const perfEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const entry = perfEntries.find((e) => e.name === url)

    if (entry && entry.transferSize > 0) {
      return entry.transferSize
    }

    if (entry && entry.encodedBodySize > 0) {
      return entry.encodedBodySize
    }

    // 方法2：尝试发送 HEAD 请求获取 Content-Length
    const response = await fetch(url, {
      method: 'HEAD'
    })

    const contentLength = response.headers.get('Content-Length')
    return contentLength ? parseInt(contentLength, 10) : 0
  } catch (error) {
    // 如果失败，返回 0
    console.debug('Failed to get size for:', url)
    return 0
  }
}

// 嗅探页面中的所有媒体资源
function sniffPageMedia(): MediaResource[] {
  const resources: MediaResource[] = []
  const seenUrls = new Set<string>()

  console.log('[Sniff] Starting general strategies...')

  // 执行所有通用嗅探策略
  sniffStrategies.forEach(strategy => {
    console.log(`[Sniff] Running strategy: ${strategy.name}`)
    const strategyResources = strategy.sniffSafely(seenUrls)
    resources.push(...strategyResources)
    console.log(`[Sniff] Strategy ${strategy.name} found ${strategyResources.length} resources`)
  })

  console.log(`[Sniff] Total resources found: ${resources.length}`)
  return resources
}