import * as TabsPrimitive from '@radix-ui/react-tabs'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tab V2.3, hai kiểu theo nền:
 *
 * - `tone="light"` (mặc định): tab gạch chân trên nền trắng (`v3.css` `.tabs`) — cao 44px, chữ `--ink-3`, tab mở `--ink` 600 + vạch
 *   2px `--cyan-500` sát mép dưới, đường kẻ dưới cả dải.
 * - `tone="sky"`: nhóm tab kính trong dải trời dưới tiêu đề màn — khay `--sky-glass` viền `--sky-glass-border` bo 12, mỗi tab cao 36
 *   bo 10; tab mở là kính cyan của thanh điều hướng (`--nav-on`), chữ trắng 600. *(đã điều chỉnh 27/09/2026)* Bản đầu dùng tab gạch
 *   chân như bản mẫu, vạch nằm sát mép card đè lên dải nên nhìn như đường kẻ thừa dưới mỗi trang; người dùng yêu cầu làm lại.
 *   Khay cách card 16px (`mb-4`), căn trái theo tiêu đề (`mx-5` bù `-mx-5` của vùng `children` trong `PageHero`).
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
      className={cn(
        'group/tabs flex gap-1',
        tone === 'light'
          ? 'border-b border-border px-3'
          : 'mx-5 mb-4 w-fit max-w-[calc(100%-40px)] overflow-x-auto rounded-[12px] border border-sky-glass-border bg-sky-glass p-1',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'group/tab inline-flex h-11 flex-none items-center gap-2 px-2.5 text-body font-medium whitespace-nowrap',
        'transition-colors duration-(--dur-fast) ease-standard',
        'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
        'text-ink-3 hover:text-ink-1 data-[state=active]:font-semibold data-[state=active]:text-ink-strong',
        'group-data-[tone=light]/tabs:data-[state=active]:shadow-[inset_0_-2px_0_var(--cyan-500)]',
        'group-data-[tone=sky]/tabs:h-9 group-data-[tone=sky]/tabs:rounded-md group-data-[tone=sky]/tabs:px-3',
        'group-data-[tone=sky]/tabs:text-sky-text-2 group-data-[tone=sky]/tabs:hover:bg-sky-glass-hover group-data-[tone=sky]/tabs:hover:text-sky-text',
        'group-data-[tone=sky]/tabs:focus-visible:outline-cyan-300',
        'group-data-[tone=sky]/tabs:data-[state=active]:bg-(image:--nav-on) group-data-[tone=sky]/tabs:data-[state=active]:shadow-nav-on',
        'group-data-[tone=sky]/tabs:data-[state=active]:text-sky-text',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Số đếm cạnh nhãn tab — pill Archivo 12/600. `warn`: việc cần người dùng xử lý (nền hổ phách). Số 0 mờ đi để tab rỗng lùi lại
 * (vẫn đọc được: độ mờ chỉ trên nền pill, chữ giữ màu).
 */
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
              children === 0 && 'group-data-[tone=sky]/tabs:bg-transparent group-data-[tone=sky]/tabs:text-sky-text-2',
              'group-data-[tone=sky]/tabs:group-data-[state=active]/tab:bg-cyan-400 group-data-[tone=sky]/tabs:group-data-[state=active]/tab:text-cyan-950',
            ),
      )}
    >
      {children}
    </span>
  )
}
