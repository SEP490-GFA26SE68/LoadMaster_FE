import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsContent } from '@/components/ui/Tabs'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { useFormat, useT } from '@/lib/i18n'
import { todayInVietnam } from './trip-dates'
import { normalizeStatusFilter, TRIP_STATUS_SLUGS, TRIP_LIST_FILTERS, TRIP_LIST_TABS, tripsPerDate, UNASSIGNED_DRIVER, type TripRow } from './trip-list'
import { createTripColumns } from './trip-list-columns'
import { TripListSkeleton } from './TripListSkeleton'
import { TripListTable } from './TripListTable'
import { TripListStats, TripListTabs } from './TripListTabs'
import { TripListToolbar } from './TripListToolbar'
import { useTripsPageQuery } from './useTripsQuery'
import {useTripFilterLookups,retainSelected} from './trip-filter-lookups'
import {dataErrorMessage} from '@/lib/i18n'
import type { TripStatus } from '@/types/trip'

const NO_ROWS: TripRow[] = []
/** Máy chủ chưa trả tên các điểm giao và phương án xếp hàng; có trả chuyến đã có tuyến tối ưu hay chưa. */
const BACKEND_COLUMNS = { routeNames: false, plans: false, routePlan: true } as const
const BY_DATE = 'scheduledDate'

/**
 * Danh sách chuyến khi nhóm `trips` nối backend (bản của nhóm): `GET /api/trips` phân trang, tìm, lọc theo trạng thái / ngày / xe / tài
 * xế và sắp xếp tại máy chủ; tab trạng thái và bộ lọc giữ trên URL như bản kho mẫu (`TripListPage`).
 */
export function BackendTripListPage() {
  const navigate = useNavigate()
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const canCreate = can('trips.edit')
  // "Cần bạn xử lý" là việc của người duyệt phương án (điều phối viên, FE-0-07); quản lý công ty chỉ đọc nên chỉ thấy các số thường
  const list = useListUrlState({
    filters: TRIP_LIST_FILTERS,
    defaultSort: { id: BY_DATE, desc: true },
  })

  const statusSlug = normalizeStatusFilter(list.filters['trang-thai'])

  const backendStatus = (
    Object.entries(TRIP_STATUS_SLUGS).find(
      ([, slug]) => slug === statusSlug,
    )?.[0] ?? ''
  ) as TripStatus | ''

  const lookups = useTripFilterLookups()
  const driverFilter = list.filters['tai-xe']

  const [currentSort] = list.sorting

  const sortFields: Record<string, string> = {
    scheduledDate: 'departureTime',
    name: 'tripName',
    id: 'tripCode',
    status: 'status',
  }

  const query = useTripsPageQuery({
    page: list.pageIndex,
    size: list.pageSize,
    search: list.query,
    status: backendStatus || undefined,
    fromDate: list.filters.tu || undefined,
    toDate: list.filters.den || undefined,
    vehicleId: list.filters.xe || undefined,
    driverId:
      driverFilter && driverFilter !== UNASSIGNED_DRIVER
        ? driverFilter
        : undefined,
    unassignedDriver: driverFilter === UNASSIGNED_DRIVER,
    sortBy: sortFields[currentSort?.id ?? ''] ?? 'departureTime',
    sortDir: currentSort?.desc === false ? 'asc' : 'desc',
  })

  const columns = useMemo(
    () => createTripColumns(t, format, BACKEND_COLUMNS),
    [t, format],
  )

  const trips = query.isFetching ? NO_ROWS : query.data?.data ?? NO_ROWS
  const totalRows = query.data?.totalElements ?? 0

  // Backend đã phân trang, không lọc hoặc cắt trang lần nữa ở FE.
  const rows = trips

  const countsByDate = useMemo(
    () => tripsPerDate(rows),
    [rows],
  )

  const options = {
    vehicles: retainSelected(lookups.vehicles.isSuccess ? lookups.vehicles.data : [], list.filters.xe, t('trips.list.vehicle')),
    drivers: [
      { value: UNASSIGNED_DRIVER, label: t('trips.list.unassigned') },
      ...retainSelected(lookups.drivers.isSuccess ? lookups.drivers.data : [], driverFilter === UNASSIGNED_DRIVER ? '' : driverFilter, t('trips.list.driver')),
    ],
  }

  const status = list.filters['trang-thai']

  const tab =
    TRIP_LIST_TABS.find(
      (item) => item.value === normalizeStatusFilter(status),
    )?.key ?? 'all'

  const hasTrips = totalRows > 0
  const hasActiveFilters =
    list.query.trim() !== '' ||
    Object.values(list.filters).some(Boolean)

  return (
    <Tabs
      value={tab}
      onValueChange={(key) => list.setFilter('trang-thai', TRIP_LIST_TABS.find((item) => item.key === key)?.value ?? '')}
      className="flex min-w-0 flex-1 flex-col"
    >
      <PageHero
        title={t('trips.list.title')}
        description={hasTrips
          ? <TripListStats total={totalRows} />
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
        <TripListTabs counts={null} />
      </PageHero>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-shell py-6">
          <TabsContent value={tab} className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg shadow-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <TripListToolbar
              list={list}
              vehicles={options.vehicles}
              drivers={options.drivers}
              grouped={list.sorting[0]?.id === BY_DATE}
              newestFirst={list.sorting[0]?.desc ?? true}
              onGroupByDate={() => {
                const grouped = list.sorting[0]?.id === BY_DATE
                const newestFirst = list.sorting[0]?.desc ?? true

                list.setSorting([
                  {
                    id: BY_DATE,
                    desc: grouped ? !newestFirst : true,
                  },
                ])
              }}
            />
            {/* Màn điều phối là màn desktop (AGENTS mục 5): khung hẹp hơn bảng thì cuộn ngang trong khung, không bóp cột */}
            {lookups.vehicles.isError || lookups.drivers.isError ? <p role="alert" className="p-4 text-danger">{dataErrorMessage(lookups.vehicles.error ?? lookups.drivers.error, t)}</p> : null}
            {query.isFetching ? <TripListSkeleton />
              : query.isError ? <p role="alert" className="p-4 text-danger">{t('trips.list.loadError')}</p>
              : !hasTrips ? <EmptyState mascot="empty" title={t('trips.list.emptyTitle')} description={t('trips.list.emptyDescription')}
                action={hasActiveFilters ? <Button onClick={list.clearAll}>{t('common.clearFilters')}</Button> : canCreate ? <Button asChild><Link to="/chuyen/moi">{t('trips.list.createFirst')}</Link></Button> : undefined} />
              : <>
            <div className="relative overflow-x-auto">
              <div className="min-w-285">
                <TripListTable
                  data={rows}
                  columns={columns}
                  sorting={list.sorting}
                  onSortingChange={list.setSorting}
                  pagination={{
                    pageIndex: list.pageIndex,
                    pageSize: list.pageSize,
                    onPageChange: list.setPage,
                    onPageSizeChange: list.setPageSize,
                  }}
                  serverPagination
                  totalRows={totalRows}
                  countsByDate={countsByDate}
                  today={todayInVietnam()}
                  onClearFilters={list.clearAll}
                  onRowClick={(trip) => void navigate(`/chuyen/${trip.id}`)}
                />
              </div>
            </div>
            </>}
          </TabsContent>
      </div>
    </Tabs>
  )
}
