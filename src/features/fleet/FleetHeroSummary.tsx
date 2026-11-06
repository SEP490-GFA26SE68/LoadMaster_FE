import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { splitUnit } from './FleetCells'
import { fleetRanges } from './vehicle-status'

/**
 * Dòng số dưới tiêu đề Đội xe (V2.3): số xe, khoảng tải trọng và khoảng chiều dài thùng, tính từ danh sách xe đã tải. Khoảng chỉ
 * ghi khi đội có hai giá trị khác nhau; đội rỗng thì không có dòng nào (màn nói "chưa có xe").
 */
export function FleetHeroSummary({ vehicles }: { vehicles: readonly VehicleConfig[] }) {
  const t = useT()
  const format = useFormat()
  const ranges = fleetRanges(vehicles)
  if (!ranges) return null

  const [minPayload, maxPayload] = ranges.payloadKg
  const [minLength, maxLength] = ranges.lengthCm
  const payload = minPayload === maxPayload
    ? t('fleet.hero.payloadOne', { max: format.weight(maxPayload) })
    : t('fleet.hero.payload', { min: splitUnit(format.weight(minPayload))[0], max: format.weight(maxPayload) })
  const length = minLength === maxLength
    ? t('fleet.hero.lengthOne', { length: format.length(maxLength) })
    : t('fleet.hero.length', { range: `${format.lengthValue(minLength)}–${format.length(maxLength)}` })

  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span>{t('fleet.hero.count', { count: ranges.count })}</span>
      <span aria-hidden>·</span>
      <span>{payload}</span>
      <span aria-hidden>·</span>
      <span>{length}</span>
    </span>
  )
}
