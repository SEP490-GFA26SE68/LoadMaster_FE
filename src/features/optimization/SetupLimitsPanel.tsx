import { ProgressBar } from '@/components/ui/ProgressBar'
import { Card } from '@/components/ui/Card'
import { roundKg } from '@/domain/geometry'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { OptimizationSetup } from './optimization-api'

const percentOf = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0)

/**
 * Thẻ "Hai giới hạn khác nhau" (V2.3 `ThietLapToiUu.jpg`): khối lượng hàng so với tải xe và thể tích hàng so với lòng thùng, tính từ
 * chuyến và xe đang chọn. Hai tỷ lệ độc lập: thể tích còn trống không có nghĩa là xếp vừa — câu cuối nói rõ điều đó. Vượt 100% thì
 * thước đo và con số tô đỏ, dòng dưới nói vượt bao nhiêu; con số vẫn là số thật, không cắt về 100.
 */
export function SetupLimitsPanel({ setup }: { setup: OptimizationSetup }) {
  const t = useT()
  const format = useFormat()
  const { trip, vehicle } = setup
  const weightKg = trip.packages.reduce((sum, pkg) => sum + pkg.weightKg * pkg.quantity, 0)
  const volumeCm3 = trip.packages.reduce((sum, pkg) => sum + pkg.lengthCm * pkg.widthCm * pkg.heightCm * pkg.quantity, 0)
  const capacityCm3 = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  const rows = [
    {
      label: t('optimization.limits.weight'),
      percent: percentOf(weightKg, vehicle.maxPayloadKg),
      detail: t('optimization.limits.detail', { value: format.weight(weightKg), capacity: format.weight(vehicle.maxPayloadKg) }),
      over: weightKg > vehicle.maxPayloadKg ? format.weight(roundKg(weightKg - vehicle.maxPayloadKg)) : null,
    },
    {
      label: t('optimization.limits.volume'),
      percent: percentOf(volumeCm3, capacityCm3),
      detail: t('optimization.limits.detail', { value: format.volumeM3(volumeCm3), capacity: format.volumeM3(capacityCm3) }),
      over: volumeCm3 > capacityCm3 ? format.volumeM3(volumeCm3 - capacityCm3) : null,
    },
  ]

  return (
    <Card role="region" aria-labelledby="setup-limits" className="px-4.5 pt-4">
      <span className="text-fine text-ink-3">{t('optimization.limits.eyebrow')}</span>
      <h2 id="setup-limits" className="mt-0.5 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{t('optimization.limits.title')}</h2>
      {rows.map((row) => (
        <div key={row.label} className="mt-4 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-small text-ink-2">{row.label}</span>
            <b className={cn('font-display text-body font-bold tabular-nums', row.over ? 'text-danger' : 'text-ink-strong')}>{format.percent(row.percent)}</b>
          </div>
          <ProgressBar value={row.percent} tone={row.over ? 'danger' : 'primary'} />
          <span className="text-fine text-ink-2 tabular-nums">
            {row.detail}
            {row.over ? <b className="font-semibold text-danger">{` · ${t('optimization.limits.over', { value: row.over })}`}</b> : null}
          </span>
        </div>
      ))}
      <p className="-mx-4.5 mt-4 border-t border-line-soft px-4.5 pt-3 pb-3.5 text-fine text-ink-3">{t('optimization.limits.note')}</p>
    </Card>
  )
}
