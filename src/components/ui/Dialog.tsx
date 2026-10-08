import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { LucideIcon } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Hộp thoại V2.3 (`.dlg`): rộng 640px, bo 18px, bóng `--e3`, lớp phủ `--scrim` (cyan-950 50 %, không làm mờ nền). Modal mở 220ms
 * standard (mục 8 AGENTS.md). Đầu hộp thoại có thể kèm ô icon theo nghĩa (`DialogHeader`), chân nền `--n-25`.
 *
 * `sheet` (V2.3 đợt 6, màn tài xế): dưới 768 px hộp thoại thành **tờ trượt từ đáy** — bo góc trên `--r-xl`, thanh nắm chỉ để trang trí, nội
 * dung cuộn bên trong, cao tối đa `100dvh − 5rem` để thanh trên còn thấy (dùng `dvh` để bàn phím ảo không che ô đang nhập). Vẫn là
 * Radix Dialog: bẫy focus, Esc, tiêu đề có nhãn không đổi. Từ 768 px vẫn là hộp thoại giữa màn. Chân hộp thoại trong tờ nên là `sticky bottom-0`.
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = DialogPrimitive.Title
export const DialogDescription = DialogPrimitive.Description

export function DialogContent({
  className,
  children,
  sheet = false,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { sheet?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-300 grid grid-cols-[minmax(0,1fr)] place-items-center overflow-y-auto p-6',
          'bg-scrim',
          'data-[state=open]:animate-[lm-fade-in_220ms_var(--ease-standard)]',
          sheet && 'max-md:place-items-end max-md:p-0',
        )}
      >
        <DialogPrimitive.Content
          className={cn(
            'flex w-160 max-w-full flex-col overflow-hidden rounded-xl bg-bg shadow-e3',
            'outline-none',
            'data-[state=open]:animate-[lm-dialog-in_220ms_var(--ease-standard)]',
            sheet && [
              'max-md:max-h-[calc(100dvh-5rem)] max-md:w-full max-md:overflow-y-auto max-md:rounded-b-none max-md:rounded-t-xl max-md:pb-[env(safe-area-inset-bottom)]',
              'max-md:data-[state=open]:animate-[lm-sheet-in_260ms_var(--ease-decelerate)]',
            ],
            className,
          )}
          {...props}
        >
          {sheet ? <span aria-hidden className="mx-auto mt-2 mb-1 h-1.5 w-10 flex-none rounded-full bg-n-300 md:hidden" /> : null}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  )
}

/** Chân hộp thoại: nền `--n-25`, đường kẻ mảnh trên, hành động dồn phải; ghi chú đứng trái thì cho nó `mr-auto`. Lề 28px khớp
 * thân hộp thoại của các màn (bản mẫu V2.3 là 22px). */
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2.5 border-t border-line-soft bg-n-25 px-7 py-3.5', className)}
      {...props}
    />
  )
}

const HEADER_ICON = {
  info: 'bg-cyan-50 text-cyan-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  success: 'bg-green-50 text-green-700',
} as const

/**
 * Đầu hộp thoại V2.3 (`.dlg-h`): ô icon 40px bo 14px tô theo nghĩa, tiêu đề Archivo 700 20px, mô tả 14/21 `--ink-2`. Tiêu đề và mô
 * tả là `DialogTitle` / `DialogDescription` của Radix nên trình đọc màn hình đọc đúng. Hộp thoại có đầu riêng thì không dùng.
 */
export function DialogHeader({
  icon: Icon,
  tone = 'info',
  title,
  description,
  className,
  children,
}: {
  icon?: LucideIcon
  tone?: keyof typeof HEADER_ICON
  title: ReactNode
  description?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('flex items-start gap-3.5 px-7 pt-6', className)}>
      {Icon ? (
        <span aria-hidden className={cn('grid size-10 flex-none place-items-center rounded-lg', HEADER_ICON[tone])}>
          <Icon className="size-5" strokeWidth={1.5} />
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <DialogPrimitive.Title className="font-display text-h2 leading-6.5 font-bold text-ink-strong font-stretch-106%">{title}</DialogPrimitive.Title>
        {description ? <DialogPrimitive.Description className="text-body leading-5.25 text-ink-2">{description}</DialogPrimitive.Description> : null}
      </div>
      {children}
    </div>
  )
}
