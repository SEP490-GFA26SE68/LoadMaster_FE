import { Boxes, CircleCheck, PackageCheck, Truck, Weight } from 'lucide-react'
import { KpiTile } from '@/components/KpiTile'
import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import type { DashboardSummary } from './dashboard-summary'

/**
 * Năm KPI của kỳ (LM-090), mỗi ô một dòng nói nguồn trong kho. Kỳ chưa có số để tính tỷ lệ thì ô hiện "—" kèm lý do,
 * không hiện 0% như thể đã đo được.
 *
 * Tông icon theo nghĩa cố định của tint (AGENTS mục 4): xong → green, vận hành → blue, phân tích phụ → violet. Số luôn cùng
 * màu mực; màu không nói số tốt hay xấu.
 */
export function KpiRow({ summary }: { summary: DashboardSummary }) {
  const t = useT()
  const format = useFormat()
  const { fill, delivery, vehicles } = summary

  return (
    <div className="grid flex-none grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      <KpiTile
        icon={CircleCheck}
        tone="green"
        label={t('manager.kpi.trips')}
        value={format.integer(summary.completedCount)}
        unit={t('manager.kpi.tripsUnit', { total: format.integer(summary.tripCount) })}
        note={t('manager.kpi.tile.trips')}
      />
      <KpiTile
        icon={Boxes}
        tone="violet"
        label={t('manager.kpi.fill')}
        value={fill.averagePercent === null ? t('manager.noValue') : format.percent(fill.averagePercent)}
        note={fill.averagePercent === null ? t('manager.kpi.tile.fillEmpty') : t('manager.kpi.tile.fill', { count: fill.planCount })}
        badge={fill.isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
      />
      <KpiTile
        icon={Weight}
        tone="blue"
        label={t('manager.kpi.delivered')}
        value={format.integer(Math.round(summary.deliveredWeightKg))}
        unit={t('manager.kpi.deliveredUnit')}
        note={t('manager.kpi.tile.delivered')}
      />
      <KpiTile
        icon={PackageCheck}
        tone="green"
        label={t('manager.kpi.clean')}
        value={delivery.cleanPercent === null ? t('manager.noValue') : format.percent(delivery.cleanPercent)}
        note={
          delivery.cleanPercent === null
            ? t('manager.kpi.tile.cleanEmpty')
            : t('manager.kpi.tile.clean', { clean: format.integer(delivery.cleanItems), total: format.integer(delivery.finishedItems) })
        }
      />
      <KpiTile
        icon={Truck}
        tone="blue"
        label={t('manager.kpi.vehicles')}
        value={format.integer(vehicles.inUse)}
        unit={t('manager.kpi.vehiclesUnit', { total: format.integer(vehicles.total) })}
        note={t('manager.kpi.tile.vehicles')}
      />
    </div>
  )
}
