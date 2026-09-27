import { PackageCheck, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { matchesQuery } from '@/lib/list-filter'
import { SHIPMENT_STATUSES, type Shipment } from '@/lib/mock-db'
import { shipmentColumns } from './shipment-columns'
import { ShipmentFormDialog } from './ShipmentFormDialog'
import { useShipmentsQuery } from './useShipmentsQuery'

const STATUS_FILTER = 'trang-thai'
/** `?tao=1&kien=RPK-…`: mở hộp thoại tạo lô, chọn sẵn kiện (từ màn Kiện hàng). */
const CREATE = 'tao'
const PACKAGES = 'kien'

/**
 * Lô hàng `/lo-hang` (luồng 1, LM-104): bảng lô của công ty (mã lô, công ty logistics nhận, số kiện, đã nhận x / y, trạng thái, ngày
 * tạo) trong một thẻ đè lên dải trời, tìm bỏ dấu, lọc trạng thái. "Tạo lô hàng" mở hộp thoại chọn kiện chưa vào lô và công ty
 * logistics; tạo xong mở chi tiết lô để bàn giao.
 */
export function ShipmentsPage() {
  const t = useT()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = useCan()('shipments.manage')
  const query = useShipmentsQuery()
  const [params, setParams] = useSearchParams()
  const list = useListUrlState({ filters: [STATUS_FILTER], defaultSort: { id: 'createdAt', desc: true } })
  const creating = params.get(CREATE) === '1'
  const initialIds = useMemo(() => (params.get(PACKAGES) ?? '').split(',').map((id) => id.trim()).filter(Boolean), [params])

  const all = useMemo(() => query.data ?? [], [query.data])
  const status = list.filters[STATUS_FILTER]
  const rows = useMemo(
    () => all.filter((row) => (status === '' || row.shipment.status === status) && matchesQuery([row.shipment.id, row.logistics?.name, row.shipment.note], list.query)),
    [all, status, list.query],
  )
  const columns = useMemo(() => shipmentColumns(t), [t])
  const statusOptions = SHIPMENT_STATUSES.map((value) => ({ value, label: t(`sourcing.shipments.status.${value}`) }))
  const hasRows = all.length > 0
  const overlap = query.isPending || (query.isSuccess && hasRows)

  function setCreating(open: boolean) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (open) next.set(CREATE, '1')
      else {
        next.delete(CREATE)
        next.delete(PACKAGES)
      }
      return next
    }, { replace: true })
  }

  function handleCreated(shipment: Shipment) {
    toast.success(t('sourcing.shipments.created', { id: shipment.id, count: shipment.packageIds.length }))
    void navigate(`/lo-hang/${shipment.id}`)
  }

  const createButton = canManage ? (
    <Button variant="primary" onClick={() => setCreating(true)}>
      <Plus strokeWidth={1.5} />
      {t('sourcing.shipments.create')}
    </Button>
  ) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={overlap}
        title={t('sourcing.shipments.title')}
        meta={query.isSuccess ? t('sourcing.shipments.count', { count: all.length }) : undefined}
        description={t('pageHero.shipments')}
        actions={hasRows ? createButton : null}
      />
      <main className={overlap ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {query.isPending ? (
          <div className="flex justify-center rounded-lg border border-border bg-bg py-16 shadow-card"><Spinner /></div>
        ) : query.error ? (
          <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
        ) : !hasRows ? (
          <EmptyState icon={PackageCheck} title={t('sourcing.shipments.empty')} description={t('sourcing.shipments.emptyDescription')} action={createButton ?? undefined} />
        ) : (
          <div className="flex flex-col gap-3">
            <section className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg shadow-card">
              <FilterBar
                layout="toolbar"
                className="min-h-14 border-b border-border px-4 py-2"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('sourcing.shipments.search')}
                fields={[{ kind: 'select', name: STATUS_FILTER, label: t('sourcing.shipments.statusFilter'), options: statusOptions }]}
                values={list.filters}
                onValueChange={list.setFilter}
                onClear={list.clearAll}
              />
              <div className="relative overflow-x-auto">
                <div className="min-w-220">
                  <DataTable
                    data={rows}
                    columns={columns}
                    getRowId={(row) => row.shipment.id}
                    density="roomy"
                    appearance="paper"
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                    isFiltering={list.isFiltering}
                    onClearFilters={list.clearAll}
                    onRowClick={(row) => void navigate(`/lo-hang/${row.shipment.id}`)}
                  />
                </div>
              </div>
            </section>
            <p className="text-caption text-ink-3">{t('sourcing.shipments.sourceNote')}</p>
          </div>
        )}
      </main>

      {creating && canManage ? (
        <ShipmentFormDialog
          initialPackageIds={initialIds}
          needManufacturer={user?.role !== 'manufacturer'}
          onClose={() => setCreating(false)}
          onSaved={handleCreated}
        />
      ) : null}
    </div>
  )
}
