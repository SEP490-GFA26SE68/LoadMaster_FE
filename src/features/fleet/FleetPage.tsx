import { Plus, RotateCcw } from 'lucide-react'
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
import { useFormat, useT } from '@/lib/i18n'
import { createFleetColumns } from './fleet-columns'
import { FleetSummary } from './FleetSummary'
import { useVehicleStatesQuery, useVehiclesQuery } from './useVehiclesQuery'
import { filterVehicleRows, vehicleRows, VEHICLE_STATUSES, VEHICLE_STATUS_SLUGS } from './vehicle-status'

const STATUS_FILTER = 'trang-thai'

/**
 * Đội xe — danh sách xe và trạng thái (LM-040, LM-089) đọc qua TanStack Query từ kho mock dùng chung (D-06), bố cục V2:
 * bốn ô số liệu (ba ô trạng thái bấm để lọc), rồi một thẻ gồm thanh tìm/lọc và bảng.
 * Tìm bỏ dấu, lọc trạng thái, sắp xếp, phân trang; trạng thái lọc giữ trên URL (`?q=…&trang-thai=bao-duong`, D-52).
 * Bấm một dòng mở trang cấu hình xe.
 */
export function FleetPage() {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const canEdit = useCan()('fleet.edit')
  const vehiclesQuery = useVehiclesQuery()
  const statesQuery = useVehicleStatesQuery()
  const list = useListUrlState({ filters: [STATUS_FILTER], defaultSort: { id: 'name', desc: false } })
  const statusSlug = list.filters[STATUS_FILTER]

  const columns = useMemo(() => createFleetColumns(t, format), [t, format])
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
        meta={vehiclesQuery.isSuccess ? t('fleet.count', { count: vehicles.length }) : undefined}
        description={t('pageHero.fleet')}
        actions={vehicles.length > 0 && canEdit ? (
          <Button variant="primary" asChild>
            <Link to="/doi-xe/moi">
              <Plus strokeWidth={1.5} />
              {t('fleet.add')}
            </Link>
          </Button>
        ) : null}
      />

      <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6">
        {isPending ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label={t('fleet.loading')}>
            <Spinner />
          </div>
        ) : isError ? (
          <EmptyState
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
            </section>
            <p className="text-caption text-ink-3">{t('fleet.sourceNote')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
