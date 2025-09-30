import { MediaResource } from '../base'
import { SniffStrategy } from './base'

/**
 * 策略4：扫描所有 <audio> 标签
 */
export class AudioTagStrategy extends SniffStrategy {
  get name(): string {
    return 'AudioTag'
  }

  get priority(): number {
    return 4
  }

  sniff(seenUrls: Set<string>): MediaResource[] {
    const resources: MediaResource[] = []

    const audios = document.querySelectorAll('audio')
    audios.forEach((audio) => {
      const url = audio.src || audio.currentSrc || audio.dataset.src || audio.getAttribute('data-src')

      if (url && !seenUrls.has(url) && this.isValidUrl(url)) {
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

        if (url && !seenUrls.has(url) && this.isValidUrl(url)) {
          seenUrls.add(url)
          resources.push({
            url,
            type: 'audio'
          })
        }
      })
    })

    return resources
  }
}