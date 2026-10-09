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
import { useVehicleStatesQuery, useVehiclesQuery } from './useVehiclesQuery'
import { filterVehicleRows, vehicleRows, VEHICLE_STATUSES, VEHICLE_STATUS_SLUGS } from './vehicle-status'

const STATUS_FILTER = 'trang-thai'

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
 * Đội xe — danh sách xe và trạng thái (LM-040, LM-089) đọc qua TanStack Query từ kho mock dùng chung (D-06), bố cục V2:
 * bốn ô số liệu (ba ô trạng thái bấm để lọc), rồi một thẻ gồm thanh tìm/lọc và bảng.
 * Tìm bỏ dấu, lọc trạng thái, sắp xếp, phân trang; trạng thái lọc giữ trên URL (`?q=…&trang-thai=bao-duong`, D-52).
 * Bấm một dòng mở trang cấu hình xe.
 */
export function FleetPage() {
  const t = useT()
  const navigate = useNavigate()
  const canEdit = useCan()('fleet.edit')
  const vehiclesQuery = useVehiclesQuery()
  const statesQuery = useVehicleStatesQuery()
  const list = useListUrlState({ filters: [STATUS_FILTER], defaultSort: { id: 'name', desc: false } })
  const statusSlug = list.filters[STATUS_FILTER]

  const columns = useMemo(() => createFleetColumns(t), [t])
  const vehicles = useMemo(() => vehicleRows(vehiclesQuery.data ?? [], statesQuery.data ?? []), [vehiclesQuery.data, statesQuery.data])
  const rows = useMemo(() => filterVehicleRows(vehicles, list.query, statusSlug), [vehicles, list.query, statusSlug])
  const statusOptions = VEHICLE_STATUSES.map((status) => ({ value: VEHICLE_STATUS_SLUGS[status], label: t(`fleet.status.${status}`) }))

  const isPending = vehiclesQuery.isPending || statesQuery.isPending
  const isError = vehiclesQuery.isError || statesQuery.isError

  function handleRetry() {
    void vehiclesQuery.refetch()
    void statesQuery.refetch()
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={t('fleet.title')}
        description={vehiclesQuery.isSuccess ? <FleetHeroSummary vehicles={vehiclesQuery.data} /> : t('pageHero.fleet')}
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
        {isPending ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label={t('fleet.loading')}>
            <Spinner />
          </div>
        ) : isError ? (
          <EmptyState
            mascot="error"
            title={t('fleet.error.title')}
            description={t('fleet.error.description')}
            action={
              <Button variant="secondary" onClick={handleRetry} loading={vehiclesQuery.isFetching || statesQuery.isFetching}>
                <RotateCcw strokeWidth={1.5} />
                {t('fleet.error.retry')}
              </Button>
            }
          />
        ) : vehicles.length === 0 ? (
          <EmptyState
            mascot="empty"
            title={t('fleet.empty.title')}
            description={t('fleet.empty.description')}
            action={canEdit ? (
              <Button variant="primary" asChild>
                <Link to="/doi-xe/moi">
                  <Plus strokeWidth={1.5} />
                  {t('fleet.empty.action')}
                </Link>
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <FleetSummary vehicles={vehicles} statusSlug={statusSlug} onStatusSlugChange={(slug) => list.setFilter(STATUS_FILTER, slug)} />
            {/* Một thẻ: thanh tìm/lọc là đầu thẻ, bảng ngay dưới (V2). flex-none: con overflow-hidden của cột flex không được co. */}
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
              <DataTable
                data={rows}
                columns={columns}
                getRowId={(row) => row.id}
                density="spacious"
                appearance="paper"
                sorting={list.sorting}
                onSortingChange={list.setSorting}
                pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                isFiltering={list.isFiltering}
                onClearFilters={list.clearAll}
                onRowClick={(vehicle) => void navigate(`/doi-xe/${vehicle.id}`)}
              />
              <FleetLegend />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
