import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'

/** Số điểm giao trong vòng tròn tô màu định danh điểm giao. Trang trí: chữ bên cạnh đã nói điểm giao, màu không đứng một mình (mục 10). */
export function StopDot({ stop, className }: { stop: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('grid size-7 flex-none place-items-center rounded-full font-display text-body-lg leading-none font-semibold tabular-nums', className)}
      style={{ background: stopColor(stop), color: stopForeground(stop) }}
    >
      {stop}
    </span>
  )
}

/**
 * Điểm giao của kiện (V2.3 đợt 6): chip sáng, số điểm trong vòng tròn tô màu định danh điểm giao (màu luôn kèm số và tên — mục 10).
 * Thay khối màu đặc chữ đen của bản trước. Chữ 16 px cho màn cảm ứng; `name` vắng thì chỉ còn nhãn ("Điểm 3" ở `label`).
 */
export function StopChip({ stop, label, name, className }: { stop: number; label: string; name?: string; className?: string }) {
  return (
    <span className={cn('inline-flex min-h-10 min-w-0 items-center gap-2 rounded-md border border-line-soft bg-surface py-1 pr-3 pl-1.5 text-body-lg font-semibold text-ink-strong', className)}>
      <StopDot stop={stop} />
      <span className="min-w-0 text-pretty">{name === undefined || name === '' ? label : `${label} · ${name}`}</span>
    </span>
  )
}
