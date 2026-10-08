import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { DeliveryView } from './delivery-progress'

/**
 * Dòng "Cần dỡ N kiện · Đã dỡ … · Sự cố …" kèm thước tiến độ dày 12px (V2.3 đợt 6): xanh lá khi đủ 100 % (màu chỉ nhấn thêm — con số và
 * phần trăm luôn đi kèm). Dòng số là vùng `aria-live`: dỡ kiện, báo sự cố đổi số thì trình đọc màn hình đọc — thay cho toast thành công. Điểm nhận dọc đường (FE-7-05) dùng câu "Cần nhận N kiện · Đã nhận …".
 */
export function StopProgress({ view }: { view: DeliveryView }) {
  const t = useT()
  const pickupStop = view.stop.kind === 'PICKUP'
  const handled = view.total - view.remaining
  const percent = view.total === 0 ? 100 : Math.round((handled / view.total) * 100)
  return (
    <div className="flex flex-none flex-col gap-2 px-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span aria-live="polite" aria-atomic="true" className="font-semibold text-ink-strong">
          {pickupStop ? t('driver.pickup.summary', { total: view.total, done: view.unloadedCount }) : t('driver.summary', { total: view.total, done: view.unloadedCount, issues: view.issueCount })}
        </span>
        <span className="font-display font-[650] tabular-nums text-ink-2">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t(pickupStop ? 'driver.pickup.progress' : 'driver.progress')}
        className="h-3 overflow-hidden rounded-full bg-n-100"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-(--dur-md) ease-decelerate', percent === 100 ? 'bg-success' : 'bg-(image:--meter-fill)')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
