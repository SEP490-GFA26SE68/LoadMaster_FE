import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Card V2.3 (`v3.css` `.card`): nền trắng, viền 1px, bo `--r-lg` 14px, bóng rất nhẹ `--card-shadow` — bóng duy nhất được phép
 * trên card (AGENTS mục 5, V2.3). Không nâng card khi rê chuột.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-lg border border-border bg-bg shadow-card', className)} {...props} />
}

/** Đầu card: 14×18px, đường chia mảnh `--line-soft`. Tiêu đề, ghi chú, rồi hành động dồn phải (`CardActions`). */
export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex min-h-13 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line-soft px-4.5 py-3.5', className)}
      {...props}
    />
  )
}

/** Tiêu đề card: Archivo 650, 16/22, rộng 106 %. `as`: cấp tiêu đề theo chỗ đặt card (mặc định h3), để thứ bậc tiêu đề không nhảy cấp. */
export function CardTitle({ className, as: Heading = 'h3', ...props }: ComponentProps<'h3'> & { as?: 'h2' | 'h3' }) {
  return (
    <Heading
      className={cn('font-display text-h3 leading-5.5 font-[650] tracking-[-0.1px] text-ink-strong font-stretch-106%', className)}
      {...props}
    />
  )
}

/** Ghi chú cạnh tiêu đề card: 13px `--ink-3`. */
export function CardMeta({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('text-small text-ink-3', className)} {...props} />
}

/** Hành động ở cuối đầu card. */
export function CardActions({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('ml-auto flex items-center gap-2', className)} {...props} />
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-4.5', className)} {...props} />
}
