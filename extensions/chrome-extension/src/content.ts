// MyNest Chrome Extension - Content Script
// 用于嗅探页面中的媒体资源

interface MediaResource {
  url: string
  type: 'image' | 'video' | 'audio'
  size?: number  // 文件大小（字节）
  width?: number  // 图片/视频宽度
  height?: number  // 图片/视频高度
  alt?: string
  thumbnail?: string  // 视频封面（base64）
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

// 异步嗅探页面中的所有媒体资源（带文件大小和视频封面）
async function sniffPageMediaAsync(): Promise<MediaResource[]> {
  const resources = sniffPageMedia()

  // 第一步：快速获取文件大小
  const resourcesWithSize = await Promise.all(
    resources.map(async (resource) => {
      const size = await getResourceSize(resource.url)
      return { ...resource, size }
    })
  )

  // 按文件大小排序（从大到小）
  const sortedResources = resourcesWithSize.sort((a, b) => (b.size || 0) - (a.size || 0))

  // 第二步：仅为前3个没有封面的视频异步生成封面（不阻塞返回）
  const videosNeedingThumbnails = sortedResources
    .filter(r => r.type === 'video' && !r.thumbnail)
    .slice(0, 3) // 只处理前3个

  if (videosNeedingThumbnails.length > 0) {
    // 在后台异步生成封面，不等待完成
    Promise.all(
      videosNeedingThumbnails.map(async (resource) => {
        const thumbnail = await captureVideoThumbnail(resource.url)
        if (thumbnail) {
          resource.thumbnail = thumbnail
          // 发送消息通知更新（可选）
          chrome.runtime.sendMessage({
            action: 'thumbnailGenerated',
            url: resource.url,
            thumbnail
          }).catch(() => {
            // 忽略错误
          })
        }
      })
    ).catch((error) => {
      console.debug('Background thumbnail generation error:', error)
    })
  }

  return sortedResources
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

// 截取视频封面
async function captureVideoThumbnail(videoUrl: string): Promise<string | undefined> {
  try {
    return await new Promise<string | undefined>((resolve) => {
      // 创建临时视频元素
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      video.style.display = 'none'
      document.body.appendChild(video)

      // 设置超时（2秒）
      const timeout = setTimeout(() => {
        cleanup()
        resolve(undefined)
      }, 2000)

      const cleanup = () => {
        clearTimeout(timeout)
        video.remove()
      }

      // 当视频可以播放时截取帧
      video.addEventListener('loadeddata', () => {
        try {
          // 跳转到视频的 1 秒位置（或视频长度的 10%）
          const seekTime = Math.min(1, video.duration * 0.1)
          video.currentTime = seekTime
        } catch (e) {
          console.debug('Failed to seek video:', e)
          cleanup()
          resolve(undefined)
        }
      })

      video.addEventListener('seeked', () => {
        try {
          // 创建 canvas 并绘制视频帧
          const canvas = document.createElement('canvas')
          const aspectRatio = video.videoWidth / video.videoHeight

          // 设置合理的缩略图尺寸
          const maxWidth = 320
          const maxHeight = 180

          if (aspectRatio > maxWidth / maxHeight) {
            canvas.width = maxWidth
            canvas.height = maxWidth / aspectRatio
          } else {
            canvas.height = maxHeight
            canvas.width = maxHeight * aspectRatio
          }

          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
            cleanup()
            resolve(thumbnail)
          } else {
            cleanup()
            resolve(undefined)
          }
        } catch (e) {
          console.debug('Failed to capture video frame:', e)
          cleanup()
          resolve(undefined)
        }
      })

      // 错误处理
      video.addEventListener('error', () => {
        console.debug('Video load error:', videoUrl)
        cleanup()
        resolve(undefined)
      })

      // 加载视频
      video.src = videoUrl
    })
  } catch (error) {
    console.debug('Failed to capture thumbnail for:', videoUrl, error)
    return undefined
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

      // 优先使用 poster 属性作为封面
      const poster = video.poster || video.getAttribute('poster')
      const thumbnail = poster && isValidMediaUrl(poster) ? poster : undefined

      resources.push({
        url,
        type: 'video',
        width: video.videoWidth || video.width || 0,
        height: video.videoHeight || video.height || 0,
        alt: video.title || '',
        thumbnail
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