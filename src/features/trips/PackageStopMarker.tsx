import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'

/**
 * Mốc số điểm giao V2.3 (`.mk`): ô vuông bo 6–7 px, số Archivo 700, nền màu điểm giao, chữ luôn đủ tương phản. Chỉ trang trí — nơi
 * dùng luôn kèm tên điểm hoặc số đọc được (AGENTS mục 10), nên `aria-hidden`.
 */
export function PackageStopMarker({ number, size = 'md', className }: { number: number; size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid flex-none place-items-center font-display leading-none font-bold tabular-nums',
        size === 'md' ? 'size-5.5 rounded-[7px] text-caption' : 'size-5 rounded-sm text-note',
        className,
      )}
      style={{ background: stopColor(number), color: stopForeground(number) }}
    >
      {number}
    </span>
  )
}
