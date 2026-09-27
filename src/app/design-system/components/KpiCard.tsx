import { KpiTile } from '@/components/KpiTile'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import type { PeriodPreset } from '@/features/manager/dashboard-period'
import { useDashboardQuery } from '@/features/manager/useDashboardQuery'
import { useFormat, useT } from '@/lib/i18n'
import { SheetCard, SkyStage } from '../SheetLayout'

/**
 * Ô số liệu kính (`KpiTile variant="sky"`) với đúng hai số đầu của Bảng điều khiển, tính bằng `summarizeDashboard` trên kho cho kỳ
 * đang chọn ở thẻ "Chọn và bật tắt".
 */
export function KpiCard({ period }: { period: PeriodPreset }) {
  const t = useT()
  const format = useFormat()
  const summary = useDashboardQuery({ preset: period, from: '', to: '' }).data

  return (
    <SheetCard title={t('designSystem.components.kpi.title')} meta={t('designSystem.components.kpi.meta')}>
      <SkyStage className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {summary ? (
          <>
            <KpiTile
              variant="sky"
              label={t('manager.kpi.trips')}
              value={format.integer(summary.completedCount)}
              unit={t('manager.kpi.tripsUnit', { total: format.integer(summary.tripCount) })}
              note={t('manager.kpi.tile.trips')}
            />
            <KpiTile
              variant="sky"
              label={t('manager.kpi.fill')}
              value={summary.fill.averagePercent === null ? t('manager.noValue') : format.percent(summary.fill.averagePercent)}
              note={summary.fill.averagePercent === null
                ? t('manager.kpi.tile.fillEmpty')
                : t('manager.kpi.tile.fill', { count: summary.fill.planCount })}
              badge={summary.fill.isMockResult ? <Badge shape="tag" tone="mock" className="text-amber-200">MOCK RESULT</Badge> : null}
            />
          </>
        ) : (
          <>
            <Skeleton dark className="h-21 rounded-lg" />
            <Skeleton dark className="h-21 rounded-lg" />
          </>
        )}
      </SkyStage>
    </SheetCard>
  )
}
