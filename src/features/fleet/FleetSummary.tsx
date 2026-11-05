import { CircleCheck, Truck, Warehouse, Wrench, type LucideIcon } from 'lucide-react'
import { KpiTile, type KpiTone } from '@/components/KpiTile'
import { useFormat, useT } from '@/lib/i18n'
import type { VehicleStatus } from '@/lib/mock-db'
import { VEHICLE_STATUSES, VEHICLE_STATUS_SLUGS, type VehicleRow } from './vehicle-status'

/** Icon và tint theo nghĩa cố định (AGENTS mục 4): sẵn sàng → xanh lá, vận hành → xanh dương, cần chú ý → hổ phách. */
const STATUS_TILE: Record<VehicleStatus, { icon: LucideIcon; tone: KpiTone }> = {
  available: { icon: CircleCheck, tone: 'green' },
  in_use: { icon: Truck, tone: 'blue' },
  maintenance: { icon: Wrench, tone: 'amber' },
}

/**
 * Bốn ô số liệu trên đầu Đội xe (V2): tổng số xe và số xe theo từng trạng thái, đếm trên **cả đội xe** (không theo ô tìm) từ
 * kho. Ba ô trạng thái là công tắc lọc: bấm thì lọc theo trạng thái đó, bấm lại ô đang lọc thì bỏ lọc — đi qua cùng bộ lọc
 * `trang-thai` trên URL với ô chọn trạng thái, nên hai nơi luôn khớp nhau.
 */
export function FleetSummary({ vehicles, statusSlug, onStatusSlugChange }: {
  vehicles: readonly VehicleRow[]
  statusSlug: string
  onStatusSlugChange: (slug: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const countOf = (status: VehicleStatus) => vehicles.filter((vehicle) => vehicle.state.status === status).length

  return (
    <div className="grid flex-none grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile
        icon={Warehouse}
        tone="slate"
        label={t('fleet.summary.total')}
        value={format.integer(vehicles.length)}
        note={t('fleet.summary.totalNote')}
      />
      {VEHICLE_STATUSES.map((status) => {
        const slug = VEHICLE_STATUS_SLUGS[status]
        const pressed = statusSlug === slug
        return (
          <KpiTile
            key={status}
            icon={STATUS_TILE[status].icon}
            tone={STATUS_TILE[status].tone}
            label={t(`fleet.status.${status}`)}
            value={format.integer(countOf(status))}
            note={t(`fleet.summary.note.${status}`)}
            pressed={pressed}
            onPress={() => onStatusSlugChange(pressed ? '' : slug)}
          />
        )
      })}
    </div>
  )
}
