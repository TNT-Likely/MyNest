import { MediaResource } from '../base'
import { SniffStrategy } from './base'

/**
 * 策略5：从 Performance API 中扫描媒体资源（捕获动态加载的资源）
 */
export class PerformanceAPIStrategy extends SniffStrategy {
  get name(): string {
    return 'PerformanceAPI'
  }

  get priority(): number {
    return 5
  }

  sniff(seenUrls: Set<string>): MediaResource[] {
    const resources: MediaResource[] = []

    try {
      const perfEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

      perfEntries.forEach((entry) => {
        const url = entry.name

        if (!seenUrls.has(url) && this.isValidUrl(url)) {
          const mediaType = this.detectMediaTypeFromUrl(url, entry.initiatorType)

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
      console.debug('[PerformanceAPI] Failed to scan:', error)
    }

    return resources
  }

  /**
   * 从 URL 检测媒体类型
   */
  private detectMediaTypeFromUrl(url: string, initiatorType?: string): 'image' | 'video' | 'audio' | null {
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
      // 平台特定域名
      /v[0-9]+-\w+\.douyinvod\.com/i,
      /v[0-9]+\.douyinstatic\.com/i,
      /googlevideo\.com/i,
      /video\.twimg\.com/i,
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
}