import { formatInteger } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Thước đo V2.3 (`.meter`): rãnh 8px `--n-100` bo tròn, phần đã đi gradient `--cyan-300 → --cyan-600`; cảnh báo / vượt ngưỡng tô
 * hổ phách / đỏ. Nhãn 13px `--ink-3`, số Archivo 650 15px. Dạng viên thuốc ở đây là thanh chỉ báo chứ không phải nút (mục 5).
 */
export function ProgressBar({
  label,
  /** 0–100 */
  value,
  className,
  tone = 'primary',
}: {
  label?: string
  value: number
  className?: string
  tone?: 'primary' | 'warning' | 'danger'
}) {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <div className="flex justify-between gap-3">
          <span className="text-small text-ink-3">{label}</span>
          <span className="font-display text-body-lg leading-none font-[650] text-ink-strong tabular-nums">
            {formatInteger(clamped)}%
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-n-100"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-(--dur-md) ease-decelerate',
            tone === 'primary' && 'bg-(image:--meter-fill)',
            tone === 'warning' && 'bg-warning',
            tone === 'danger' && 'bg-red-500',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
