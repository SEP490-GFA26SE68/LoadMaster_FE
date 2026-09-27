import { Download, Plus } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import type { DashboardSummary } from './dashboard-summary'
import { FleetStatusCard } from './FleetStatusCard'
import { KpiRow } from './KpiRow'
import { PeriodFilter } from './PeriodFilter'
import { RecentTripsTable } from './RecentTripsTable'
import { useDashboardPeriod } from './useDashboardPeriod'
import { useDashboardQuery } from './useDashboardQuery'
import { useExportReport } from './useExportReport'

/**
 * `recharts` nằm ở chunk riêng: phần còn lại của màn hiện ngay, ba biểu đồ theo sau (AGENTS mục 9 "Chia chunk"). Cả ba cùng một
 * module `DashboardCharts`, nên chỉ tải một lần.
 */
const loadCharts = () => import('./DashboardCharts')
const TripsByStatusChart = lazy(() => loadCharts().then((m) => ({ default: m.TripsByStatusChart })))
const FillByDayChart = lazy(() => loadCharts().then((m) => ({ default: m.FillByDayChart })))
const WeightByVehicleChart = lazy(() => loadCharts().then((m) => ({ default: m.WeightByVehicleChart })))

/**
 * Bảng điều khiển (LM-052, LM-090, V2): lọc kỳ trên URL, 5 KPI theo kỳ, 3 biểu đồ, thẻ đội xe, chuyến trong kỳ và xuất báo cáo
 * .xlsx. Mọi số tính từ kho qua `useDashboardQuery` (D-48). Đúng một nút primary (mục 5): người lập kế hoạch (`trips.edit`) có "Tạo kế hoạch
 * xếp", xuất báo cáo là nút phụ; quản lý chỉ xem nên "Xuất báo cáo" là hành động chính.
 */
export function DashboardPage() {
  const t = useT()
  const can = useCan()
  const period = useDashboardPeriod()
  const query = useDashboardQuery(period.selection)
  const exportReport = useExportReport()
  const canCreate = can('trips.edit')
  const canExport = can('reports.export')
  const summary = query.data

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('manager.title')}
        description={t('pageHero.dashboard')}
        actions={
          <>
            {canExport ? (
              <Button
                variant={canCreate ? 'glass' : 'primary'}
                loading={exportReport.isPending}
                disabled={!summary || exportReport.isPending}
                onClick={() => {
                  if (summary) exportReport.mutate(summary)
                }}
              >
                {exportReport.isPending ? null : <Download strokeWidth={1.5} aria-hidden />}
                {t('manager.export.button')}
              </Button>
            ) : null}
            {canCreate ? (
              <Button asChild>
                <Link to="/chuyen/moi">
                  <Plus strokeWidth={1.5} aria-hidden />
                  {t('manager.createPlan')}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-shell py-6">
        <PeriodFilter
          selection={period.selection}
          range={summary?.period}
          onPresetChange={(preset) => period.setPreset(preset, summary?.period)}
          onDateChange={period.setCustomDate}
        />
        {query.isPending ? (
          <p className="text-body text-text-2">{t('manager.loading')}</p>
        ) : query.isError ? (
          <EmptyState
            title={t('manager.errorTitle')}
            description={t('manager.errorDescription')}
            action={
              <Button variant="secondary" onClick={() => void query.refetch()}>
                {t('manager.retry')}
              </Button>
            }
          />
        ) : (
          <DashboardContent summary={query.data} />
        )}
      </div>
    </div>
  )
}

/** Lưới V2: cột phân tích rộng bên trái, cột hẹp bên phải (đội xe, theo xe). Dưới 1.280 px xếp một cột. */
const INSIGHTS_GRID = 'grid flex-none gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'

/**
 * Bố cục V2: KPI của kỳ → chuyến theo trạng thái cạnh thẻ đội xe → lấp đầy theo ngày cạnh khối lượng theo xe → bảng chuyến.
 * Thẻ đội xe không theo kỳ nên vẫn hiện khi kỳ không có chuyến.
 */
function DashboardContent({ summary }: { summary: DashboardSummary }) {
  const t = useT()
  if (summary.tripCount === 0) {
    return (
      <>
        <KpiRow summary={summary} />
        <div className={INSIGHTS_GRID}>
          <EmptyState title={t('manager.empty.title')} description={t('manager.empty.description')} />
          <FleetStatusCard vehicles={summary.vehicles} />
        </div>
      </>
    )
  }
  return (
    <>
      <KpiRow summary={summary} />
      <div className={INSIGHTS_GRID}>
        <Suspense fallback={<ChartSkeleton />}>
          <TripsByStatusChart entries={summary.tripsByStatus} total={summary.tripCount} />
        </Suspense>
        <FleetStatusCard vehicles={summary.vehicles} />
        <Suspense fallback={<ChartSkeleton />}>
          <FillByDayChart days={summary.fillByDay} isMockResult={summary.fill.isMockResult} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <WeightByVehicleChart vehicles={summary.byVehicle} />
        </Suspense>
      </div>
      <RecentTripsTable trips={summary.trips} />
    </>
  )
}

/** Giữ chỗ đúng khung một biểu đồ trong lúc tải chunk `recharts`, để bảng bên dưới không nhảy. */
function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-bg p-5">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-60 w-full" />
    </div>
  )
}
