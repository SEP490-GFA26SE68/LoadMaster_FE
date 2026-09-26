import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Khối giữ chỗ khi đang tải. Trên nền sáng: dải sáng chạy ngang
 * (surface → border → surface). Trên nền tối: mảng trắng mờ nhấp nháy.
 * `prefers-reduced-motion` đã tắt animation ở cấp toàn cục (mục 8).
 */
export function Skeleton({
  className,
  dark = false,
  ...props
}: ComponentProps<'span'> & { dark?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block rounded-sm',
        dark
          ? 'bg-white/8 animate-[lm-pulse_1.8s_ease-in-out_infinite]'
          : 'bg-[linear-gradient(90deg,var(--n-100)_25%,var(--n-50)_50%,var(--n-100)_75%)] bg-[length:200%_100%] animate-[lm-shimmer_1.6s_linear_infinite]',
        className,
      )}
      {...props}
    />
  )
}
