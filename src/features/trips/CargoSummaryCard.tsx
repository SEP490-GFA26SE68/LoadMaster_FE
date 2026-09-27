import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { CargoSummary } from './trip-summary'

/**
 * Mục "Tóm tắt hàng hoá" ở cột phải Chi tiết chuyến (LM-044; V2.3 `ChiTietChuyen.jpg`): hai ô tải trọng và thể tích sử dụng — số
 * phần trăm lớn, "đã dùng / sức chứa" của xe, thước đo. Vượt tải trọng thì thước đo đỏ kèm một dòng cảnh báo. Mọi số tính từ kiện của
 * chuyến và thông số xe.
 */
export function CargoSummaryCard({ summary, vehicle }: { summary: CargoSummary; vehicle: VehicleConfig }) {
  const t = useT()
  const format = useFormat()
  const capacityCm3 = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  // Spec §15 "Tự tính tổng khối lượng và thể tích": tổng kiện, thể tích, khối lượng giữ trên đầu mục (bản mẫu V2.3 chỉ có hai ô %)
  const totals = [
    { label: t('trips.instances'), value: format.integer(summary.instances) },
    { label: t('trips.volume'), value: format.volumeM3(summary.volumeCm3) },
    { label: t('trips.weight'), value: format.weight(summary.weightKg) },
  ]
  return (
    <div className="flex flex-col gap-3">
      <dl className="m-0 grid grid-cols-3 gap-2">
        {totals.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-fine text-ink-3">{item.label}</dt>
            <dd className="m-0 font-display text-body-lg leading-5 font-[650] text-ink-strong tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-2 gap-3">
        <UsageTile
          label={t('trips.payloadUsage')}
          percent={summary.payloadPercent}
          of={t('trips.detail.ofTotal', { used: format.weight(summary.weightKg), total: format.weight(vehicle.maxPayloadKg) })}
          over={summary.overPayload}
        />
        <UsageTile
          label={t('trips.volumeUsage')}
          percent={summary.volumePercent}
          of={t('trips.detail.ofTotal', { used: format.volumeM3(summary.volumeCm3), total: format.volumeM3(capacityCm3) })}
        />
      </div>
      {summary.overPayload ? <p className="m-0 text-fine font-semibold text-red-700">{t('trips.overPayload')}</p> : null}
    </div>
  )
}

function UsageTile({ label, percent, of, over = false }: { label: string; percent: number; of: string; over?: boolean }) {
  const format = useFormat()
  const clamped = Math.min(100, Math.max(0, percent))
  const [number, unit] = splitPercent(format.percent(percent))
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col rounded-md border border-line-soft bg-n-25 px-3 py-3">
      <span className="text-fine text-ink-3">{label}</span>
      <span className={cn('mt-1.5 font-display text-[26px] leading-none font-bold tabular-nums font-stretch-108%', over ? 'text-red-700' : 'text-ink-strong')}>
        {number}
        {unit ? <small className="ml-0.5 font-sans text-body font-medium text-ink-3">{unit}</small> : null}
      </span>
      <span className="mt-1.5 text-fine text-ink-3 tabular-nums">{of}</span>
      <span aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-n-100">
        <span className={cn('block h-full rounded-full', over ? 'bg-red-500' : 'bg-(image:--meter-fill)')} style={{ width: `${clamped}%` }} />
      </span>
    </div>
  )
}

/** "71,9%" → ["71,9", "%"]: dấu phần trăm nhỏ hơn số (V2.3). Locale đặt dấu ở chỗ khác thì giữ nguyên chuỗi. */
function splitPercent(value: string): [string, string | null] {
  return value.endsWith('%') ? [value.slice(0, -1).trimEnd(), '%'] : [value, null]
}
