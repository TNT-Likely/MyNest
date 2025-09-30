import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  children?: (props: { value: boolean; onChange: (value: boolean) => void }) => React.ReactNode
}

export function confirm(options: ConfirmOptions): Promise<boolean | { confirmed: true; data: boolean }> {
  const {
    title,
    description,
    confirmText = '确认',
    cancelText = '取消',
    variant = 'default',
    children,
  } = options

  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const cleanup = () => {
      root.unmount()
      document.body.removeChild(container)
    }

    function ConfirmDialog() {
      const [checkboxValue, setCheckboxValue] = useState(false)

      const handleConfirm = () => {
        cleanup()
        if (children) {
          resolve({ confirmed: true, data: checkboxValue })
        } else {
          resolve(true)
        }
      }

      const handleCancel = () => {
        cleanup()
        resolve(false)
      }

      return (
        <AlertDialog open={true} onOpenChange={(open) => !open && handleCancel()}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription>{description}</AlertDialogDescription>
              )}
            </AlertDialogHeader>
            {children && (
              <div className="py-4">
                {children({ value: checkboxValue, onChange: setCheckboxValue })}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancel}>{cancelText}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                className={
                  variant === 'destructive'
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
                    : ''
                }
              >
                {confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )
    }

    root.render(<ConfirmDialog />)
  })
}