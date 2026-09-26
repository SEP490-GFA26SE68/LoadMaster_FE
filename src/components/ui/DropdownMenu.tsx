import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Menu thả xuống V2.3 (`v3.css` `.menu`): nền trắng đặc (không kính), bo 14px, padding 6px, bóng `--e2` (lớp nổi được bóng, mục 5
 * AGENTS.md). Mục 36px bo 10px, icon `--ink-3`; `tone="danger"` cho mục xoá / khoá.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-62 overflow-hidden rounded-lg bg-bg p-1.5 shadow-e2',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  tone,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { tone?: 'danger' }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 whitespace-nowrap',
        'text-body text-text outline-none',
        'data-[highlighted]:bg-n-50',
        'data-[disabled]:pointer-events-none data-[disabled]:text-n-600',
        '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3',
        tone === 'danger' && 'text-danger [&_svg]:text-danger',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('flex flex-col gap-0.5 px-2.5 pt-2 pb-1.5', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('mx-1 my-1.5 h-px bg-line-soft', className)}
      {...props}
    />
  )
}

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

/** Mục chọn một (ngôn ngữ giao diện): dấu tích `--primary` ở phải khi đang chọn. */
export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 whitespace-nowrap',
        'text-body text-text outline-none data-[highlighted]:bg-n-50 data-[state=checked]:bg-cyan-50 data-[state=checked]:font-semibold',
        className,
      )}
      {...props}
    >
      {children}
      <DropdownMenuPrimitive.ItemIndicator className="ml-auto">
        <Check className="size-4 text-primary" strokeWidth={2} aria-hidden />
      </DropdownMenuPrimitive.ItemIndicator>
    </DropdownMenuPrimitive.RadioItem>
  )
}
