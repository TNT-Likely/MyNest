// 媒体资源接口
export interface MediaResource {
  url: string
  type: 'image' | 'video' | 'audio'
  size?: number  // 文件大小（字节）
  width?: number  // 图片/视频宽度
  height?: number  // 图片/视频高度
  alt?: string
  thumbnail?: string  // 视频封面（base64 或 URL）
}