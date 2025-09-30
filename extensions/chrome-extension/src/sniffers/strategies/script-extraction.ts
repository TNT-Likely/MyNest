import { MediaResource } from '../base'
import { SniffStrategy } from './base'

/**
 * 策略7：从页面 script 标签中提取视频 URL（针对抖音等平台）
 */
export class ScriptExtractionStrategy extends SniffStrategy {
  get name(): string {
    return 'ScriptExtraction'
  }

  get priority(): number {
    return 7
  }

  sniff(seenUrls: Set<string>): MediaResource[] {
    const resources: MediaResource[] = []

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

            if (url && !seenUrls.has(url) && this.isValidUrl(url) && this.isVideoUrl(url)) {
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
      console.debug('[ScriptExtraction] Failed to scan:', error)
    }

    return resources
  }

  /**
   * 判断 URL 是否是视频 URL
   */
  private isVideoUrl(url: string): boolean {
    const urlLower = url.toLowerCase()

    const videoPatterns = [
      /\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv|m4v|3gp|ts)(\?|$)/i,
      /\.m3u8/i,
      /\.mpd/i,
      /douyinvod\.com/i,
      /douyinstatic\.com/i,
      /aweme\.snssdk\.com/i
    ]

    return videoPatterns.some(pattern => pattern.test(urlLower))
  }
}