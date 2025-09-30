// MyNest Chrome Extension - Content Script
// 用于嗅探页面中的媒体资源

interface MediaResource {
  url: string
  type: 'image' | 'video' | 'audio'
  size?: number  // 文件大小（字节）
  width?: number  // 图片/视频宽度
  height?: number  // 图片/视频高度
  alt?: string
}

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

  // 尝试获取每个资源的文件大小
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

  // 1. 扫描所有图片
  const images = document.querySelectorAll('img')
  images.forEach((img) => {
    // 尝试多个可能的 URL 属性
    const url = img.src || img.dataset.src || img.getAttribute('data-src') || img.getAttribute('data-original')
    if (url && !seenUrls.has(url) && isValidMediaUrl(url)) {
      seenUrls.add(url)
      resources.push({
        url,
        type: 'image',
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
        alt: img.alt || img.title || ''
      })
    }
  })

  // 2. 扫描 CSS 背景图片
  const allElements = document.querySelectorAll('*')
  allElements.forEach((el) => {
    const style = window.getComputedStyle(el)
    const bgImage = style.backgroundImage
    if (bgImage && bgImage !== 'none') {
      const matches = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/)
      if (matches && matches[1]) {
        const url = matches[1]
        if (!seenUrls.has(url) && isValidMediaUrl(url)) {
          seenUrls.add(url)
          resources.push({
            url,
            type: 'image'
          })
        }
      }
    }
  })

  // 3. 扫描所有视频
  const videos = document.querySelectorAll('video')
  videos.forEach((video) => {
    // 尝试多个可能的 URL 属性
    let url = video.src || video.currentSrc || video.dataset.src || video.getAttribute('data-src')

    // 如果是 blob URL，尝试从其他属性找原始 URL
    if (url && url.startsWith('blob:')) {
      // 尝试从 data 属性中找原始 URL
      const dataUrl = video.getAttribute('data-url') ||
                      video.getAttribute('data-video-url') ||
                      video.getAttribute('data-original-src') ||
                      video.dataset.url ||
                      video.dataset.videoUrl

      if (dataUrl && isValidMediaUrl(dataUrl)) {
        url = dataUrl
      }
    }

    if (url && !seenUrls.has(url) && isValidMediaUrl(url)) {
      seenUrls.add(url)
      resources.push({
        url,
        type: 'video',
        width: video.videoWidth || video.width || 0,
        height: video.videoHeight || video.height || 0,
        alt: video.title || ''
      })
    }

    // 扫描 video 标签内的 source 元素
    const sources = video.querySelectorAll('source')
    sources.forEach((source) => {
      const url = source.src || source.dataset.src || source.getAttribute('data-src')
      if (url && !seenUrls.has(url) && isValidMediaUrl(url)) {
        seenUrls.add(url)
        resources.push({
          url,
          type: 'video',
          width: video.videoWidth || video.width || 0,
          height: video.videoHeight || video.height || 0
        })
      }
    })
  })

  // 4. 扫描所有音频
  const audios = document.querySelectorAll('audio')
  audios.forEach((audio) => {
    const url = audio.src || audio.currentSrc || audio.dataset.src || audio.getAttribute('data-src')
    if (url && !seenUrls.has(url) && isValidMediaUrl(url)) {
      seenUrls.add(url)
      resources.push({
        url,
        type: 'audio',
        alt: audio.title || ''
      })
    }

    // 扫描 audio 标签内的 source 元素
    const sources = audio.querySelectorAll('source')
    sources.forEach((source) => {
      const url = source.src || source.dataset.src || source.getAttribute('data-src')
      if (url && !seenUrls.has(url) && isValidMediaUrl(url)) {
        seenUrls.add(url)
        resources.push({
          url,
          type: 'audio'
        })
      }
    })
  })

  // 5. 从 Performance API 中扫描媒体资源（捕获动态加载的资源）
  try {
    const perfEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    perfEntries.forEach((entry) => {
      const url = entry.name
      if (!seenUrls.has(url) && isValidMediaUrl(url)) {
        const mediaType = detectMediaTypeFromUrl(url, entry.initiatorType)
        if (mediaType) {
          seenUrls.add(url)
          resources.push({
            url,
            type: mediaType
          })
        }
      }
    })
  } catch (error) {
    console.debug('Failed to scan Performance API:', error)
  }

  // 6. 扫描所有元素的自定义属性（兜底方案）
  try {
    const allElements = document.querySelectorAll('[data-video-url], [data-video-src], [data-stream-url]')
    allElements.forEach((el) => {
      const url = el.getAttribute('data-video-url') ||
                  el.getAttribute('data-video-src') ||
                  el.getAttribute('data-stream-url')

      if (url && !seenUrls.has(url) && isValidMediaUrl(url)) {
        seenUrls.add(url)
        resources.push({
          url,
          type: 'video'
        })
      }
    })
  } catch (error) {
    console.debug('Failed to scan custom attributes:', error)
  }

  // 7. 从页面 script 标签中提取视频 URL（针对抖音等平台）
  try {
    const scripts = document.querySelectorAll('script')
    scripts.forEach((script) => {
      const content = script.textContent || script.innerHTML
      if (!content) return

      // 匹配视频 URL 模式
      const urlPatterns = [
        // 抖音视频 URL 模式
        /["']?(https?:\/\/[^"'\s]+?\.(?:mp4|m3u8|flv)[^"'\s]*?)["']?/gi,
        // 抖音特定域名
        /["']?(https?:\/\/v[0-9]+-\w+\.douyinvod\.com[^"'\s]*?)["']?/gi,
        /["']?(https?:\/\/v[0-9]+\.douyinstatic\.com[^"'\s]*?)["']?/gi,
        /["']?(https?:\/\/aweme\.snssdk\.com[^"'\s]+?)["']?/gi,
        // 通用视频 URL
        /video[Uu]rl["']?\s*[:=]\s*["']([^"']+?)["']/gi,
        /playAddr["']?\s*[:=]\s*["']([^"']+?)["']/gi,
        /play_addr["']?\s*[:=]\s*\{[^}]*?["']url_list["']?\s*:\s*\[(["'][^"']+?["'])/gi,
        /src["']?\s*[:=]\s*["'](https?:\/\/[^"']+?\.(?:mp4|m3u8|flv)[^"']*?)["']/gi
      ]

      for (const pattern of urlPatterns) {
        let match
        while ((match = pattern.exec(content)) !== null) {
          const url = match[1] || match[0].replace(/["']/g, '')
          if (url && !seenUrls.has(url) && isValidMediaUrl(url) && detectMediaTypeFromUrl(url) === 'video') {
            seenUrls.add(url)
            resources.push({
              url,
              type: 'video'
            })
          }
        }
      }
    })
  } catch (error) {
    console.debug('Failed to scan scripts:', error)
  }

  return resources
}

// 从 URL 检测媒体类型
function detectMediaTypeFromUrl(url: string, initiatorType?: string): 'image' | 'video' | 'audio' | null {
  const urlLower = url.toLowerCase()

  // 如果 Performance API 提供了 initiatorType，优先使用
  if (initiatorType === 'video') return 'video'
  if (initiatorType === 'audio') return 'audio'
  if (initiatorType === 'img') return 'image'

  // 视频扩展名和特征
  const videoPatterns = [
    /\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv|m4v|3gp|ts)(\?|$)/i,
    /video/i,
    /\.m3u8/i, // HLS
    /\.mpd/i,  // DASH
    // 抖音相关域名和特征 (优先匹配)
    /v[0-9]+-\w+\.douyinvod\.com/i,
    /v[0-9]+\.douyinstatic\.com/i,
    /v[0-9]+\-\w+\.douyincdn\.com/i,
    /aweme\.snssdk\.com.*video/i,
    /douyin\.com.*\.(mp4|flv)/i,
    /aweme\.com/i,
    /snssdk\.com.*\.(mp4|flv)/i,
    /bytecdn\.cn.*video/i,
    /bytedance\.com.*video/i,
    /ixigua\.com.*\.(mp4|flv)/i,
    /toutiao\.com.*video/i,
    // 快手
    /ks-live-.*\.com/i,
    /kuaishou\.com.*video/i,
    // 其他视频平台特征
    /xiaohongshu\.com.*video/i,
    /xhscdn\.com.*video/i,
    /bilibili\.com.*\.(mp4|flv)/i,
    /bilivideo\.(com|cn)/i
  ]

  // 音频扩展名和特征
  const audioPatterns = [
    /\.(mp3|wav|ogg|aac|m4a|flac|wma)(\?|$)/i,
    /audio/i
  ]

  // 图片扩展名和特征
  const imagePatterns = [
    /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?|$)/i,
    /image/i
  ]

  for (const pattern of videoPatterns) {
    if (pattern.test(urlLower)) return 'video'
  }

  for (const pattern of audioPatterns) {
    if (pattern.test(urlLower)) return 'audio'
  }

  for (const pattern of imagePatterns) {
    if (pattern.test(urlLower)) return 'image'
  }

  return null
}

// 验证是否是有效的媒体 URL
function isValidMediaUrl(url: string): boolean {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
    return false
  }

  try {
    const urlObj = new URL(url, window.location.href)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch (e) {
    return false
  }
}