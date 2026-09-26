import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tab gạch chân V2.3 (`v3.css` `.tabs`, `.sky-tabs`): cao 44px, chữ 14px. Tab đang chọn đậm 600 và có vạch 2px sát mép dưới.
 *
 * - `tone="light"` (mặc định): trên nền trắng — chữ `--ink-3`, tab mở `--ink` + vạch `--cyan-500`, đường kẻ dưới cả dải.
 * - `tone="sky"`: nằm trong dải trời dưới tiêu đề màn — chữ trắng 72 %, tab mở trắng + vạch `--cyan-400`, không đường kẻ.
 *
 * `TabsList` đặt nhóm `tabs` và `data-tone`; `TabsTrigger`, `TabCount` đọc lại qua `group-data-*` — không cần context.
 */
export const Tabs = TabsPrimitive.Root
export const TabsContent = TabsPrimitive.Content

export function TabsList({
  className,
  tone = 'light',
  ...props
}: ComponentProps<typeof TabsPrimitive.List> & { tone?: 'light' | 'sky' }) {
  return (
    <TabsPrimitive.List
      data-tone={tone}
      className={cn('group/tabs flex gap-1', tone === 'light' ? 'border-b border-border px-3' : 'px-5', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'group/tab inline-flex h-11 items-center gap-2 px-2.5 text-body font-medium whitespace-nowrap',
        'transition-colors duration-(--dur-fast) ease-standard',
        'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
        'text-ink-3 hover:text-ink-1 data-[state=active]:font-semibold data-[state=active]:text-ink-strong',
        'data-[state=active]:shadow-[inset_0_-2px_0_var(--cyan-500)]',
        'group-data-[tone=sky]/tabs:text-sky-text-2 group-data-[tone=sky]/tabs:hover:text-sky-text',
        'group-data-[tone=sky]/tabs:focus-visible:outline-cyan-300',
        'group-data-[tone=sky]/tabs:data-[state=active]:text-sky-text',
        'group-data-[tone=sky]/tabs:data-[state=active]:shadow-[inset_0_-2px_0_var(--cyan-400)]',
        className,
      )}
      {...props}
    />
  )
}

/** Số đếm cạnh nhãn tab — pill Archivo 12/600. `warn`: việc cần người dùng xử lý (nền hổ phách). */
export function TabCount({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn' | 'danger'; children: number }) {
  const warn = tone !== 'neutral'
  return (
    <span
      className={cn(
        'rounded-full px-1.75 py-0.75 font-display text-caption leading-none font-semibold tabular-nums',
        warn
          ? 'bg-amber-500 text-n-900'
          : cn(
              'bg-n-100 text-ink-2 group-data-[state=active]/tab:bg-cyan-50 group-data-[state=active]/tab:text-cyan-800',
              'group-data-[tone=sky]/tabs:bg-sky-glass-hover group-data-[tone=sky]/tabs:text-sky-text',
              'group-data-[tone=sky]/tabs:group-data-[state=active]/tab:bg-cyan-400 group-data-[tone=sky]/tabs:group-data-[state=active]/tab:text-cyan-950',
            ),
      )}
    >
      {children}
    </span>
  )
}
