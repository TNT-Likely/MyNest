// 通用嗅探策略统一导出
export { SniffStrategy } from './base'
export { ImageTagStrategy } from './image-tag'
export { BackgroundImageStrategy } from './background-image'
export { VideoTagStrategy } from './video-tag'
export { AudioTagStrategy } from './audio-tag'
export { PerformanceAPIStrategy } from './performance-api'
export { CustomAttributesStrategy } from './custom-attributes'
export { ScriptExtractionStrategy } from './script-extraction'

import { SniffStrategy } from './base'
import { ImageTagStrategy } from './image-tag'
import { BackgroundImageStrategy } from './background-image'
import { VideoTagStrategy } from './video-tag'
import { AudioTagStrategy } from './audio-tag'
import { PerformanceAPIStrategy } from './performance-api'
import { CustomAttributesStrategy } from './custom-attributes'
import { ScriptExtractionStrategy } from './script-extraction'

/**
 * 所有通用嗅探策略列表
 * 按优先级排序（数字越小优先级越高）
 */
export const sniffStrategies: SniffStrategy[] = [
  new ImageTagStrategy(),           // 1. 图片标签
  new BackgroundImageStrategy(),    // 2. CSS 背景图片
  new VideoTagStrategy(),            // 3. 视频标签
  new AudioTagStrategy(),            // 4. 音频标签
  new PerformanceAPIStrategy(),      // 5. Performance API
  new CustomAttributesStrategy(),    // 6. 自定义属性
  new ScriptExtractionStrategy()     // 7. 脚本提取
].sort((a, b) => a.priority - b.priority)