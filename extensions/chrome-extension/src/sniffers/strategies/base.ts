import { MediaResource } from '../base'

/**
 * 通用嗅探策略抽象基类
 * 用于嗅探页面中的通用媒体资源（不限平台）
 */
export abstract class SniffStrategy {
  /**
   * 策略名称
   */
  abstract get name(): string

  /**
   * 策略优先级（数字越小优先级越高）
   */
  abstract get priority(): number

  /**
   * 执行嗅探
   * @param seenUrls 已经嗅探到的 URL 集合（用于去重）
   */
  abstract sniff(seenUrls: Set<string>): MediaResource[]

  /**
   * 验证 URL 是否有效
   */
  protected isValidUrl(url: string): boolean {
    if (!url || url.startsWith('data:')) {
      return false
    }

    // 允许 blob: URL
    if (url.startsWith('blob:')) {
      return true
    }

    try {
      const urlObj = new URL(url, window.location.href)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch (e) {
      return false
    }
  }

  /**
   * 安全地执行嗅探（带错误处理）
   */
  public sniffSafely(seenUrls: Set<string>): MediaResource[] {
    try {
      return this.sniff(seenUrls)
    } catch (error) {
      console.debug(`[Strategy:${this.name}] Sniffing error:`, error)
      return []
    }
  }
}