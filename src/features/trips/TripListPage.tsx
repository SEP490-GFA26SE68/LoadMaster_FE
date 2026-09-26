import { Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { useFormat, useT } from '@/lib/i18n'
import { EmptyTripsIllustration } from './EmptyTripsIllustration'
import { FILTERABLE_STATUSES, filterTripRows, TRIP_LIST_FILTERS, TRIP_STATUS_GROUP_SLUGS, tripFilterOptions, UNASSIGNED_DRIVER, type TripListFilter, type TripRow } from './trip-list'
import { createTripColumns } from './trip-list-columns'
import { TripListSkeleton } from './TripListSkeleton'
import { TripSummary } from './TripSummary'
import { useTripsQuery } from './useTripsQuery'

const NO_ROWS: TripRow[] = []

/**
 * Danh sách chuyến (LM-053, LM-088): đọc kho qua `useTripsQuery`; tìm bỏ dấu, lọc trạng thái / khoảng ngày chạy / xe / tài xế,
 * sắp xếp (mặc định ngày chạy mới nhất trước) và phân trang, giữ trên URL (D-52).
 */
export function TripListPage() {
  const navigate = useNavigate()
  const t = useT()
  const format = useFormat()
  const canCreate = useCan()('trips.edit')
  const query = useTripsQuery()
  const list = useListUrlState({ filters: TRIP_LIST_FILTERS, defaultSort: { id: 'scheduledDate', desc: true } })
  const columns = useMemo(() => createTripColumns(t, format), [t, format])
  const trips = query.data ?? NO_ROWS
  const rows = useMemo(() => filterTripRows(trips, list.query, list.filters), [trips, list.query, list.filters])
  const fields = useMemo<FilterField<TripListFilter>[]>(() => {
    const { vehicles, drivers } = tripFilterOptions(trips)
    // Hai nhóm của ô số liệu đứng đầu danh sách trạng thái: bấm ô thì ô chọn hiện đúng nhóm đang lọc
    const groups = (['active', 'review'] as const).map((group) => ({ value: TRIP_STATUS_GROUP_SLUGS[group], label: t(`trips.list.summary.${group}`) }))
    const statuses = FILTERABLE_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) }))
    return [
      { kind: 'select', name: 'trang-thai', label: t('trips.list.status'), options: [...groups, ...statuses] },
      { kind: 'dateRange', label: t('trips.list.date'), from: 'tu', to: 'den', secondary: true },
      { kind: 'select', name: 'xe', label: t('trips.list.vehicle'), options: vehicles, secondary: true },
      { kind: 'select', name: 'tai-xe', label: t('trips.list.driver'), options: [{ value: UNASSIGNED_DRIVER, label: t('trips.list.unassigned') }, ...drivers], secondary: true },
    ]
  }, [trips, t])
  const hasTrips = trips.length > 0

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={t('trips.list.title')}
        description={t('pageHero.trips')}
        actions={hasTrips && canCreate ? (
          <Button variant="primary" asChild>
            <Link to="/chuyen/moi">
              <Plus strokeWidth={1.5} />
              {t('trips.list.create')}
            </Link>
          </Button>
        ) : null}
      />

      <div className="sky-overlap flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-shell pb-6">
        {query.isPending ? (
          <TripListSkeleton />
        ) : query.isError ? (
          <p role="alert" className="text-body text-danger">{t('trips.list.loadError')}</p>
        ) : !hasTrips ? (
          <EmptyState
            illustration={<EmptyTripsIllustration />}
            title={t('trips.list.emptyTitle')}
            description={t('trips.list.emptyDescription')}
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
          <>
            <TripSummary trips={trips} status={list.filters['trang-thai']} onStatusChange={(value) => list.setFilter('trang-thai', value)} />
            {/* Một thẻ: thanh tìm/lọc là đầu thẻ, bảng ngay dưới (V2). flex-none: con overflow-hidden của cột flex không được co. */}
            <section className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
              <FilterBar
                layout="toolbar"
                className="border-b border-border px-4 py-3"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('trips.list.search')}
                fields={fields}
                values={list.filters}
                onValueChange={list.setFilter}
                onClear={list.clearAll}
              />
              {/* Màn điều phối là màn desktop (AGENTS mục 5): khung hẹp hơn bảng thì cuộn ngang trong khung, không bóp cột */}
              <div className="relative overflow-x-auto">
                <div className="min-w-285">
                  <DataTable
                    data={rows}
                    columns={columns}
                    getRowId={(row) => row.id}
                    density="roomy"
                    appearance="paper"
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                    isFiltering={list.isFiltering}
                    onClearFilters={list.clearAll}
                    onRowClick={(trip) => void navigate(`/chuyen/${trip.id}`)}
                  />
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
