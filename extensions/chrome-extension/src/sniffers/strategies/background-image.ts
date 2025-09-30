import { MediaResource } from '../base'
import { SniffStrategy } from './base'

/**
 * 策略2：扫描 CSS 背景图片
 */
export class BackgroundImageStrategy extends SniffStrategy {
  get name(): string {
    return 'BackgroundImage'
  }

  get priority(): number {
    return 2
  }

  sniff(seenUrls: Set<string>): MediaResource[] {
    const resources: MediaResource[] = []

    const allElements = document.querySelectorAll('*')
    allElements.forEach((el) => {
      const style = window.getComputedStyle(el)
      const bgImage = style.backgroundImage

      if (bgImage && bgImage !== 'none') {
        const matches = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/)
        if (matches && matches[1]) {
          const url = matches[1]

          if (!seenUrls.has(url) && this.isValidUrl(url)) {
            seenUrls.add(url)
            resources.push({
              url,
              type: 'image'
            })
          }
        }
      }
    })

    return resources
  }
}