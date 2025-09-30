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
  console.log('[Copy] 开始复制文本:', text.substring(0, 50) + '...')

  try {
    // 方法1: 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      console.log('[Copy] 使用 Clipboard API')
      await navigator.clipboard.writeText(text)
      console.log('[Copy] ✅ Clipboard API 复制成功')
      return true
    }

    console.log('[Copy] 回退到 execCommand 方法 (isSecureContext:', window.isSecureContext, ')')

    // 方法2: 回退到 execCommand (适用于非 HTTPS 环境)
    const textArea = document.createElement('textarea')
    textArea.value = text

    // 关键修复：textarea 必须可见但在视口外，并且不能是 readonly
    textArea.style.position = 'absolute'
    textArea.style.left = '-9999px'
    textArea.style.top = '0'
    textArea.style.width = '1px'
    textArea.style.height = '1px'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    // 不设置 readonly，某些浏览器需要可编辑才能复制

    document.body.appendChild(textArea)

    // 先移除当前选区
    const selection = window.getSelection()
    const originalSelection = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

    // 聚焦并选中 textarea
    textArea.focus()
    textArea.select()

    // 使用 setSelectionRange 确保选中全部内容
    try {
      textArea.setSelectionRange(0, textArea.value.length)
    } catch (err) {
      console.warn('[Copy] setSelectionRange 失败:', err)
    }

    // 验证是否真的选中了
    const selectedText = window.getSelection()?.toString()
    console.log('[Copy] 选中的文本:', selectedText?.substring(0, 50) + '...')

    try {
      const successful = document.execCommand('copy')
      console.log('[Copy] execCommand 执行结果:', successful)

      // 恢复原来的选区
      if (originalSelection) {
        selection?.removeAllRanges()
        selection?.addRange(originalSelection)
      }

      document.body.removeChild(textArea)

      if (successful) {
        console.log('[Copy] ✅ execCommand 复制成功')
        return true
      } else {
        console.error('[Copy] ❌ execCommand 返回 false')
        return false
      }
    } catch (err) {
      console.error('[Copy] ❌ execCommand 抛出异常:', err)

      // 恢复原来的选区
      if (originalSelection) {
        selection?.removeAllRanges()
        selection?.addRange(originalSelection)
      }

      document.body.removeChild(textArea)
      return false
    }
  } catch (err) {
    console.error('[Copy] ❌ 复制失败:', err)
    return false
  }
}
