import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 复制文本到剪贴板
 * 支持多种方式，确保在各种环境下都能正常工作
 * @param text 要复制的文本
 * @returns Promise<boolean> 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 方法1: 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // 方法2: 回退到 execCommand (适用于非 HTTPS 环境)
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      const successful = document.execCommand('copy')
      textArea.remove()
      return successful
    } catch (err) {
      console.error('execCommand copy failed:', err)
      textArea.remove()
      return false
    }
  } catch (err) {
    console.error('Failed to copy text:', err)
    return false
  }
}
