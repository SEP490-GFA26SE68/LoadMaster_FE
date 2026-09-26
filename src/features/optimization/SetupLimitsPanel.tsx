import { ProgressBar } from '@/components/ui/ProgressBar'
import { useFormat, useT } from '@/lib/i18n'
import type { OptimizationSetup } from './optimization-api'

const percentOf = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0)

/**
 * Khối tổng hợp kính "Hai giới hạn khác nhau" (V2): khối lượng hàng so với tải xe và thể tích hàng so với lòng thùng, tính từ chuyến
 * và xe đang chọn. Hai tỷ lệ độc lập: thể tích còn trống không có nghĩa là xếp vừa — câu cuối nói rõ điều đó. Vượt 100% thì thanh
 * đổi tông cảnh báo; con số vẫn là số thật, không cắt về 100.
 */
export function SetupLimitsPanel({ setup }: { setup: OptimizationSetup }) {
  const t = useT()
  const format = useFormat()
  const { trip, vehicle } = setup
  const weightKg = trip.packages.reduce((sum, pkg) => sum + pkg.weightKg * pkg.quantity, 0)
  const volumeCm3 = trip.packages.reduce((sum, pkg) => sum + pkg.lengthCm * pkg.widthCm * pkg.heightCm * pkg.quantity, 0)
  const capacityCm3 = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  const rows = [
    { label: t('optimization.limits.weight'), percent: percentOf(weightKg, vehicle.maxPayloadKg), detail: t('optimization.limits.detail', { value: format.weight(weightKg), capacity: format.weight(vehicle.maxPayloadKg) }) },
    { label: t('optimization.limits.volume'), percent: percentOf(volumeCm3, capacityCm3), detail: t('optimization.limits.detail', { value: format.volumeM3(volumeCm3), capacity: format.volumeM3(capacityCm3) }) },
  ]

  return (
    <section aria-labelledby="setup-limits" className="flex flex-col gap-4 rounded-lg border border-border bg-bg px-5 py-4 shadow-card">
      <div className="flex flex-col gap-0.5">
        <span className="text-caption text-ink-3">{t('optimization.limits.eyebrow')}</span>
        <h2 id="setup-limits" className="text-h3 font-semibold text-ink-strong">{t('optimization.limits.title')}</h2>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body text-ink-1">{row.label}</span>
            <span className="text-body font-semibold text-ink-strong tabular-nums">{format.percent(row.percent)}</span>
          </div>
          <ProgressBar value={row.percent} tone={row.percent > 100 ? 'warning' : 'primary'} />
          <span className="font-mono text-caption text-ink-2">{row.detail}</span>
        </div>
      ))}
      <p className="border-t border-border pt-3 text-note text-ink-3">{t('optimization.limits.note')}</p>
    </section>
  )
}
