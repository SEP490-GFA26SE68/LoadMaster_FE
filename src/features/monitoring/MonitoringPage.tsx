import { useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Spinner } from '@/components/ui/Spinner'
import { TabCount, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { EscalationTab } from './EscalationTab'
import { MonitoringBoard } from './MonitoringBoard'
import { ESCALATION_TAB, INCIDENT_PARAM, LATE_PARAM, TAB_PARAM, TRIP_PARAM, type MonitoringFilter } from './monitoring-view'
import { useMonitoringBoardQuery } from './useMonitoringQuery'
import { useFleetMonitoringQuery } from './useTrackingQuery'

const FILTER_PARAMS: Readonly<Record<keyof MonitoringFilter, string>> = { late: LATE_PARAM, incidents: INCIDENT_PARAM }

/**
 * Giám sát `/giam-sat` (FE-6-10, D-86) — điều phối viên và quản lý công ty (`monitoring.view`). Tab "Chuyến đang chạy": bản đồ các xe
 * Đang vận chuyển, danh sách cạnh nó (cũng là bản thay thế bản đồ cho trình đọc màn hình) và chi tiết của chuyến đang chọn. Người có
 * `deadlines.renegotiate` (quản lý công ty) có thêm tab "Sự cố cần xử lý" (FE-6-12); người khác không có dải tab. Tab, chuyến đang chọn
 * và hai công tắc lọc nằm trên URL. Trang này chỉ đọc phần ít đổi của các chuyến: vị trí và ETA theo nhịp của kho đọc ở các thành phần
 * con, nên dải tiêu đề không vẽ lại theo từng điểm vị trí.
 */
export function MonitoringPage() {
  const t = useT()
  const can = useCan()
  const board = useMonitoringBoardQuery()
  const [params, setParams] = useSearchParams()
  const canRenegotiate = can('deadlines.renegotiate')
  const tab = canRenegotiate && params.get(TAB_PARAM) === ESCALATION_TAB ? 'escalations' : 'trips'
  const filter: MonitoringFilter = { late: params.get(LATE_PARAM) === '1', incidents: params.get(INCIDENT_PARAM) === '1' }
  const trips = board.data?.trips ?? []
  const hasTrips = trips.length > 0

  function update(change: (next: URLSearchParams) => void) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      change(next)
      return next
    }, { replace: true })
  }
  const setOrDelete = (next: URLSearchParams, name: string, value: string | null) => (value === null ? next.delete(name) : next.set(name, value))

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => update((next) => setOrDelete(next, TAB_PARAM, value === 'escalations' ? ESCALATION_TAB : null))}
      className="flex min-w-0 flex-1 flex-col"
    >
      <PageHero
        overlap={hasTrips}
        title={t('monitoring.title')}
        meta={board.isSuccess ? t('monitoring.count', { count: trips.length }) : undefined}
        description={t('pageHero.monitoring')}
      >
        {canRenegotiate && hasTrips ? (
          <TabsList tone="sky" aria-label={t('monitoring.tabs.label')}>
            <TabsTrigger value="trips">{t('monitoring.tabs.trips')}<TabCount>{trips.length}</TabCount></TabsTrigger>
            <TabsTrigger value="escalations">{t('monitoring.tabs.escalations')}<EscalationCount /></TabsTrigger>
          </TabsList>
        ) : null}
      </PageHero>

      <div className={hasTrips ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {board.isPending ? (
          <div role="status" aria-label={t('monitoring.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : board.isError ? (
          <Banner tone="danger">{dataErrorMessage(board.error, t)}</Banner>
        ) : !hasTrips ? (
          <EmptyState mascot="empty" title={t('monitoring.empty.title')} description={t('monitoring.empty.description')} />
        ) : (
          <TabsContent value={tab} className="outline-none">
            {tab === 'escalations' ? (
              <EscalationTab board={board.data} />
            ) : (
              <MonitoringBoard
                board={board.data}
                filter={filter}
                requestedTripId={params.get(TRIP_PARAM)}
                onToggleFilter={(name) => update((next) => setOrDelete(next, FILTER_PARAMS[name], filter[name] ? null : '1'))}
                onClearFilter={() => update((next) => Object.values(FILTER_PARAMS).forEach((name) => next.delete(name)))}
                onSelectTrip={(tripId) => update((next) => next.set(TRIP_PARAM, tripId))}
              />
            )}
          </TabsContent>
        )}
      </div>
    </Tabs>
  )
}

/** Số sự cố đã chuyển lên mà quản lý công ty chưa nhập hạn mới, trên tab của họ: đọc giám sát ở đây để chỉ con số này vẽ lại theo nhịp của kho. */
function EscalationCount() {
  const fleet = useFleetMonitoringQuery(true).data ?? []
  const count = fleet.flatMap((live) => live.exceptions).filter((exception) => exception.status === 'ESCALATED' && exception.renegotiation === undefined).length
  return <TabCount tone={count > 0 ? 'warn' : 'neutral'}>{count}</TabCount>
}
