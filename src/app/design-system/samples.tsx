import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Hai mẫu nhỏ của bản V2.3 mà `src/components` chưa có thành phần dùng chung, vẽ tại chỗ cho hai trang tài liệu:
 * - chip lọc `.chip` (32px, bo 10px, bật: nền `--cyan-50` viền `--cyan-300`) — màn Kiện hàng có bản riêng dạng viên thuốc;
 * - nhóm mục kính `.glass-nav` thu nhỏ, cùng lớp với mục của thanh điều hướng (`NavRail`).
 */
export function FilterChip({ pressed, className, children, ...props }: ComponentProps<'button'> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.75 text-body font-medium whitespace-nowrap',
        'transition-colors duration-(--dur-fast) ease-standard [&_svg]:size-3.5 [&_svg]:shrink-0',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        pressed ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-border bg-bg text-ink-2 hover:bg-surface',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** Nhóm mục điều hướng trên dải trời, thu nhỏ. Chỉ để trình bày trong `Preview`: mục không dẫn đi đâu. */
export function GlassNavSample({ items, active }: { items: readonly ReactNode[]; active: number }) {
  return (
    <div className="glass-nav inline-flex gap-0.5 self-start rounded-lg p-1">
      {items.map((item, index) => (
        <span
          key={index}
          className={cn(
            'flex h-9 items-center rounded-md px-3.5 text-body whitespace-nowrap',
            index === active ? 'bg-(image:--nav-on) font-semibold text-sky-text shadow-nav-on' : 'font-medium text-sky-text-2',
          )}
        >
          {item}
        </span>
      ))}
    </div>
  )
}
