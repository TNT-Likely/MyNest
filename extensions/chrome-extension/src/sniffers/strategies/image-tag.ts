import { MediaResource } from '../base'
import { SniffStrategy } from './base'

/**
 * 策略1：扫描所有 <img> 标签
 */
export class ImageTagStrategy extends SniffStrategy {
  get name(): string {
    return 'ImageTag'
  }

  get priority(): number {
    return 1
  }

  sniff(seenUrls: Set<string>): MediaResource[] {
    const resources: MediaResource[] = []

    const images = document.querySelectorAll('img')
    images.forEach((img) => {
      // 尝试多个可能的 URL 属性
      const url = img.src || img.dataset.src || img.getAttribute('data-src') || img.getAttribute('data-original')

      if (url && !seenUrls.has(url) && this.isValidUrl(url)) {
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

    return resources
  }
}