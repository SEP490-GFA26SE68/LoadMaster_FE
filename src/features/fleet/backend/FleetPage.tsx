import { Container, Info, Plus, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import { createFleetColumns } from './fleet-columns'
import { FleetHeroSummary } from './FleetHeroSummary'
import { FleetSummary } from './FleetSummary'
import { useVehiclesQuery } from './useVehiclesQuery'
import {
  statusFromSlug,
  VEHICLE_STATUSES,
  VEHICLE_STATUS_SLUGS,
} from './vehicle-status'

const STATUS_FILTER = 'trang-thai'
const TYPE_FILTER = 'loai-xe'

/** Chân thẻ danh sách (V2.3): trạng thái lấy từ đâu và cách đọc hình lòng thùng — màu vật cản, cạnh cửa sau. */
function FleetLegend() {
  const t = useT()
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 bg-surface px-4 py-3 text-small text-ink-3">
      <p className="flex min-w-0 items-start gap-2">
        <Info aria-hidden className="mt-0.5 size-4 flex-none" strokeWidth={1.5} />
        <span>{t('fleet.sourceNote')} {t('fleet.legend.scale')}</span>
      </p>
      <p className="flex flex-none items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1 w-3.5 rounded-xs bg-(--obstacle)" />
          {t('fleet.legend.obstacle')}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-3.5 w-1 rounded-xs bg-cyan-500" />
          {t('fleet.legend.door')}
        </span>
      </p>
    </footer>
  )
}

/**
 * Đội xe — danh sách xe và trạng thái (LM-040, LM-089) đọc server-side qua TanStack Query, bố cục V2:
 * bốn ô số liệu (ba ô trạng thái bấm để lọc), rồi một thẻ gồm thanh tìm/lọc và bảng.
 * Tìm bỏ dấu, lọc trạng thái, sắp xếp, phân trang; trạng thái lọc giữ trên URL (`?q=…&trang-thai=bao-duong`, D-52).
 * Bấm một dòng mở trang cấu hình xe.
 */
export function FleetPage() {
  const t = useT()
  const navigate = useNavigate()
  const canEdit = useCan()('fleet.edit')
  const list = useListUrlState({
    filters: [STATUS_FILTER, TYPE_FILTER],
    defaultSort: {
      id: 'name',
      desc: false,
    },
  })

  const vehiclesQuery = useVehiclesQuery(
    list.pageIndex,
    list.pageSize,
    list.query,
    list.filters[TYPE_FILTER] || undefined,
    { status: statusFromSlug(list.filters[STATUS_FILTER]) ?? undefined,
      sortBy: list.sorting[0]?.id ?? 'name',
      sortDir: list.sorting[0]?.desc ? 'DESC' : 'ASC' },
  )


  const columns = useMemo(
    () => createFleetColumns(t),
    [t],
  )

  const vehicles = useMemo(() => vehiclesQuery.data?.data ?? [], [vehiclesQuery.data])

  const rows = vehicles

  const statusOptions = VEHICLE_STATUSES.map((status) => ({
    value: VEHICLE_STATUS_SLUGS[status],
    label: t(`fleet.status.${status}`),
  }))

  const isPending = vehiclesQuery.isFetching
  const isError = vehiclesQuery.isError

  function handleRetry() {
    void vehiclesQuery.refetch()
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('fleet.title')}
        description={
          vehiclesQuery.isSuccess && !isPending
            ? (
              <FleetHeroSummary
                vehicles={vehicles}
                totalElements={vehiclesQuery.data?.totalElements}
              />
            )
            : t('pageHero.fleet')
        }
        actions={
          <>
            {/* Review 1 (LM-104): danh mục loại xe nằm dưới Đội xe, không thêm mục vào thanh điều hướng */}
            <Button variant="glass" asChild>
              <Link to="/doi-xe/loai-xe">
                <Container strokeWidth={1.5} />
                {t('vehicleTypes.title')}
              </Link>
            </Button>
            {vehicles.length > 0 && canEdit ? (
              <Button variant="primary" asChild>
                <Link to="/doi-xe/moi">
                  <Plus strokeWidth={1.5} />
                  {t('fleet.add')}
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6">
        <div className="flex flex-col gap-4">
          {vehiclesQuery.isSuccess && !isPending ? (
            <FleetSummary totalElements={vehiclesQuery.data.totalElements} />
          ) : null}
            <section className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg">
              <FilterBar
                layout="toolbar"
                className="min-h-14 border-b border-border px-4 py-2"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('fleet.search')}
                fields={[{ kind: 'select', name: STATUS_FILTER, label: t('fleet.columns.status'), options: statusOptions }]}
                values={list.filters}
                onValueChange={list.setFilter}
                onClear={list.clearAll}
              />
              {list.filters[TYPE_FILTER] ? (
                <p className="px-4 py-2 text-small text-ink-3">{t('fleet.columns.vehicleType')}: #{list.filters[TYPE_FILTER]}</p>
              ) : null}
              {isPending ? (
                <div className="flex items-center justify-center py-16" role="status" aria-label={t('fleet.loading')}><Spinner /></div>
              ) : isError ? (
                <EmptyState mascot="error" title={t('fleet.error.title')} description={t('fleet.error.description')}
                  action={<Button variant="secondary" onClick={handleRetry} loading={vehiclesQuery.isFetching}><RotateCcw strokeWidth={1.5} />{t('fleet.error.retry')}</Button>} />
              ) : vehicles.length === 0 && !list.isFiltering ? (
                <EmptyState mascot="empty" title={t('fleet.empty.title')} description={t('fleet.empty.description')}
                  action={canEdit ? <Button variant="primary" asChild><Link to="/doi-xe/moi"><Plus strokeWidth={1.5} />{t('fleet.empty.action')}</Link></Button> : undefined} />
              ) : <DataTable
                data={rows}
                columns={columns}
                getRowId={(row) => row.id}
                density="spacious"
                appearance="paper"
                serverPagination
                serverSorting
                totalRows={vehiclesQuery.data?.totalElements ?? 0}
                sorting={list.sorting}
                onSortingChange={list.setSorting}
                pagination={{
                  pageIndex: list.pageIndex,
                  pageSize: list.pageSize,
                  onPageChange: list.setPage,
                  onPageSizeChange: list.setPageSize,
                }}
                isFiltering={list.isFiltering}
                onClearFilters={list.clearAll}
                onRowClick={(vehicle) =>
                  void navigate(`/doi-xe/${vehicle.id}`)
                }
              />}
              <FleetLegend />
            </section>
          </div>
      </div>
    </div>
  )
}
