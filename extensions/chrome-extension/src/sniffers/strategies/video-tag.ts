import { MediaResource } from '../base'
import { SniffStrategy } from './base'

/**
 * 策略3：扫描所有 <video> 标签
 */
export class VideoTagStrategy extends SniffStrategy {
  get name(): string {
    return 'VideoTag'
  }

  get priority(): number {
    return 3
  }

  sniff(seenUrls: Set<string>): MediaResource[] {
    const resources: MediaResource[] = []

    const videos = document.querySelectorAll('video')
    videos.forEach((video) => {
      // 尝试多个可能的 URL 属性
      let url = video.src || video.currentSrc || video.dataset.src || video.getAttribute('data-src')

      // 如果是 blob URL，尝试从其他属性找原始 URL
      if (url && url.startsWith('blob:')) {
        const dataUrl = video.getAttribute('data-url') ||
                        video.getAttribute('data-video-url') ||
                        video.getAttribute('data-original-src') ||
                        video.dataset.url ||
                        video.dataset.videoUrl

        if (dataUrl && this.isValidUrl(dataUrl)) {
          url = dataUrl
        }
      }

      if (url && !seenUrls.has(url) && this.isValidUrl(url)) {
        seenUrls.add(url)

        // 优先使用 poster 属性作为封面
        const poster = video.poster || video.getAttribute('poster')
        const thumbnail = poster && this.isValidUrl(poster) ? poster : undefined

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

        if (url && !seenUrls.has(url) && this.isValidUrl(url)) {
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

    return resources
  }
}