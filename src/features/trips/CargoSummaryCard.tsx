import { useFormat, useT } from '@/lib/i18n'
import type { CargoSummary } from './trip-summary'

/** Tách "4,8 m³" thành số và đơn vị để đơn vị nhỏ hơn số (V2); chuỗi không có đơn vị giữ nguyên. */
function splitUnit(value: string): [string, string | null] {
  const at = value.lastIndexOf(' ')
  return at === -1 ? [value, null] : [value.slice(0, at), value.slice(at + 1)]
}

/**
 * Khối tổng hợp hàng của chuyến (LM-044, V2): ba số lớn trên nền kính — kiện, thể tích, khối lượng — tính từ kiện của chuyến. Tỷ lệ
 * sử dụng thùng nằm ở thẻ phương tiện, cạnh tải trọng và lòng thùng mà nó so sánh.
 */
export function CargoSummaryCard({ summary }: { summary: CargoSummary }) {
  const t = useT()
  const format = useFormat()
  const metrics = [
    { label: t('trips.instances'), value: format.integer(summary.instances) },
    { label: t('trips.volume'), value: format.volumeM3(summary.volumeCm3) },
    { label: t('trips.weight'), value: format.weight(summary.weightKg) },
  ]
  // Nằm ở cột hẹp (~300 px): mỗi số một dòng "nhãn — số", không chia ba cột để số dài như "4.042,5 kg" không tràn
  return (
    <section aria-label={t('trips.cargoSummary')} className="flex flex-col rounded-lg border border-border bg-bg px-4.5 py-1.5 shadow-card">
      {metrics.map((metric) => {
        const [number, unit] = splitUnit(metric.value)
        return (
          <div key={metric.label} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
            <span className="text-body text-ink-2">{metric.label}</span>
            <span className="text-h2 font-semibold whitespace-nowrap text-ink-strong tabular-nums">
              {number}
              {/* Khoảng trắng nằm trong nút chữ để câu đọc liền mạch vẫn là "4,8 m³" */}
              {unit ? <span className="text-body font-normal text-ink-2">{` ${unit}`}</span> : null}
            </span>
          </div>
        )
      })}
    </section>
  )
}
