import { MediaResource } from '../base'
import { SniffStrategy } from './base'

/**
 * 策略6：扫描所有元素的自定义属性（兜底方案）
 */
export class CustomAttributesStrategy extends SniffStrategy {
  get name(): string {
    return 'CustomAttributes'
  }

  get priority(): number {
    return 6
  }

  sniff(seenUrls: Set<string>): MediaResource[] {
    const resources: MediaResource[] = []

    try {
      const allElements = document.querySelectorAll('[data-video-url], [data-video-src], [data-stream-url]')

      allElements.forEach((el) => {
        const url = el.getAttribute('data-video-url') ||
                    el.getAttribute('data-video-src') ||
                    el.getAttribute('data-stream-url')

        if (url && !seenUrls.has(url) && this.isValidUrl(url)) {
          seenUrls.add(url)
          resources.push({
            url,
            type: 'video'
          })
        }
      })
    } catch (error) {
      console.debug('[CustomAttributes] Failed to scan:', error)
    }

    return resources
  }
}