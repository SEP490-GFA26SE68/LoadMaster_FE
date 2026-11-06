import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsContent } from '@/components/ui/Tabs'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { todayInVietnam } from './trip-dates'
import { filterTripRows, needsAction, normalizeStatusFilter, TRIP_LIST_FILTERS, TRIP_LIST_TABS, tripFilterOptions, tripsPerDate, tripTabCounts, UNASSIGNED_DRIVER, type TripRow } from './trip-list'
import { createTripColumns } from './trip-list-columns'
import { TripListSkeleton } from './TripListSkeleton'
import { TripListTable } from './TripListTable'
import { TripListStats, TripListTabs } from './TripListTabs'
import { TripListToolbar } from './TripListToolbar'
import { useTripsCapabilities } from './trips-capabilities'
import { useTripsQuery } from './useTripsQuery'
import { BackendTripListPage } from './BackendTripListPage'
import { TRIPS_CAPABILITIES } from './trips-capabilities'

const NO_ROWS: TripRow[] = []
const BY_DATE = 'scheduledDate'

/**
 * Danh sách chuyến V2.3 (`ChuyenHang.jpg`; LM-053, LM-088, LM-103): đọc kho qua `useTripsQuery`. Dải trời có dòng số (cả kho) và tab
 * theo sáu trạng thái của chuyến (FE-0-05) — tab là bộ lọc `trang-thai`; thẻ bảng đè lên dải có ô tìm bỏ dấu, chip ngày chạy / xe /
 * tài xế, bảng nhóm theo ngày chạy (mặc định mới nhất trước) và phân trang. Mọi trạng thái giữ trên URL (D-52). Nhóm `trips` đọc
 * backend: tab, bộ lọc và số đếm vẫn tính ở client trên danh sách của máy chủ; bỏ nút tạo, cột lấp đầy, tên tuyến và số "cần bạn xử lý"
 * (`TRIPS_CAPABILITIES`). Nhóm `trips` nối backend thì màn là `BackendTripListPage` của nhóm: máy chủ phân trang, lọc, sắp xếp.
 */
export function TripListPage() {
  return TRIPS_CAPABILITIES.backend ? <BackendTripListPage /> : <StoreTripListPage />
}

function StoreTripListPage() {
  const navigate = useNavigate()
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const caps = useTripsCapabilities()
  const canCreate = caps.edit && can('trips.edit')
  // "Cần bạn xử lý" là việc của người duyệt phương án (điều phối viên, FE-0-07); quản lý công ty chỉ đọc nên chỉ thấy các số thường.
  // Backend chưa trả phương án: không có số nào để đếm.
  const canAct = caps.plans && can('plans.approve')
  const query = useTripsQuery()
  const list = useListUrlState({ filters: TRIP_LIST_FILTERS, defaultSort: { id: BY_DATE, desc: true } })
  const columns = useMemo(() => createTripColumns(t, format, caps), [t, format, caps])
  const trips = query.data ?? NO_ROWS
  const status = list.filters['trang-thai']
  const rows = useMemo(() => filterTripRows(trips, list.query, list.filters), [trips, list.query, list.filters])
  // Số trên tab: theo tìm và các bộ lọc khác, bỏ riêng bộ lọc trạng thái (chính là tab)
  const tabRows = useMemo(
    () => filterTripRows(trips, list.query, { ...list.filters, 'trang-thai': '' }),
    [trips, list.query, list.filters],
  )
  const tabCounts = useMemo(() => tripTabCounts(tabRows), [tabRows])
  const stats = useMemo(() => tripTabCounts(trips), [trips])
  const countsByDate = useMemo(() => tripsPerDate(rows), [rows])
  const options = useMemo(() => {
    const { vehicles, drivers } = tripFilterOptions(trips)
    return { vehicles, drivers: [{ value: UNASSIGNED_DRIVER, label: t('trips.list.unassigned') }, ...drivers] }
  }, [trips, t])
  const [sort] = list.sorting
  const grouped = sort?.id === BY_DATE
  const newestFirst = sort?.desc ?? true
  // Giá trị cũ trên URL (trước FE-0-05) đọc sang slug mới; giá trị lạ không khớp chuyến nào và không tab nào sáng
  const tab = TRIP_LIST_TABS.find((item) => item.value === normalizeStatusFilter(status))?.key ?? status
  const hasTrips = trips.length > 0
  // Card đè lên dải trời chỉ khi thứ đầu tiên của vùng cuộn là thẻ nền đặc (bảng hoặc khung tải), không phải chữ trần
  const overlap = query.isPending || (query.isSuccess && hasTrips)

  return (
    <Tabs
      value={tab}
      onValueChange={(key) => list.setFilter('trang-thai', TRIP_LIST_TABS.find((item) => item.key === key)?.value ?? '')}
      className="flex min-w-0 flex-1 flex-col"
    >
      <PageHero
        overlap={overlap}
        title={t('trips.list.title')}
        description={hasTrips
          ? <TripListStats total={stats.all} transit={stats.IN_TRANSIT} review={canAct ? trips.filter(needsAction).length : undefined} />
          : t('pageHero.trips')}
        actions={hasTrips && canCreate ? (
          <Button variant="primary" asChild>
            <Link to="/chuyen/moi">
              <Plus strokeWidth={1.5} />
              {t('trips.list.create')}
            </Link>
          </Button>
        ) : null}
      >
        {query.isError || (query.isSuccess && !hasTrips)
          ? null
          : <TripListTabs counts={hasTrips ? tabCounts : null} needAction={canAct ? tabRows.filter(needsAction).length : undefined} />}
      </PageHero>

      <div className={overlap ? 'sky-overlap flex min-h-0 flex-1 flex-col overflow-auto px-shell pb-7' : 'flex min-h-0 flex-1 flex-col overflow-auto px-shell py-6'}>
        {query.isPending ? (
          <TripListSkeleton />
        ) : query.isError ? (
          // Máy chủ từ chối (vai trò, phiên) thì nói đúng lý do của nó
          <p role="alert" className="text-body text-danger">
            {t('trips.list.loadError')}{caps.backend ? ` ${dataErrorMessage(query.error, t)}` : null}
          </p>
        ) : !hasTrips ? (
          <EmptyState
            mascot="empty"
            title={t('trips.list.emptyTitle')}
            description={t(caps.backend ? 'trips.backend.emptyDescription' : 'trips.list.emptyDescription')}
            action={canCreate ? (
              <Button variant="primary" asChild>
                <Link to="/chuyen/moi">
                  <Plus strokeWidth={1.5} />
                  {t('trips.list.createFirst')}
                </Link>
              </Button>
            ) : undefined}
          />
        ) : (
          // Một thẻ: thanh tìm/lọc là đầu thẻ, bảng ngay dưới. flex-none: con overflow-hidden của cột flex không được co.
          <TabsContent value={tab} className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg shadow-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <TripListToolbar
              list={list}
              vehicles={options.vehicles}
              drivers={options.drivers}
              grouped={grouped}
              newestFirst={newestFirst}
              onGroupByDate={() => list.setSorting([{ id: BY_DATE, desc: grouped ? !newestFirst : true }])}
            />
            {/* Màn điều phối là màn desktop (AGENTS mục 5): khung hẹp hơn bảng thì cuộn ngang trong khung, không bóp cột */}
            <div className="relative overflow-x-auto">
              <div className="min-w-285">
                <TripListTable
                  data={rows}
                  columns={columns}
                  sorting={list.sorting}
                  onSortingChange={list.setSorting}
                  pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                  countsByDate={countsByDate}
                  today={todayInVietnam()}
                  onClearFilters={list.clearAll}
                  onRowClick={(trip) => void navigate(`/chuyen/${trip.id}`)}
                />
              </div>
            </div>
          </TabsContent>
        )}
      </div>
    </Tabs>
  )
}
