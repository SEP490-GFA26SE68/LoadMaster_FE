import { ClipboardList, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { CancelOrderDialog } from './CancelOrderDialog'
import { orderColumns } from './order-columns'
import { filterOrderRows, ORDER_STATUS_ORDER, ORDER_STATUS_SLUGS } from './order-list'
import { OrderAssignDialog } from './OrderAssignDialog'
import { OrderFormDialog } from './OrderFormDialog'
import type { OrderRow } from './orders-api'
import { OrdersTableContext, type OrderAction, type OrdersTableContextValue } from './orders-table-context'
import { useAssignableTripsQuery, useOrdersQuery, useUnassignOrderMutation } from './useOrdersQuery'

const STATUS_FILTER = 'trang-thai'

type Editing = { kind: 'create' } | { kind: 'edit'; row: OrderRow }

/**
 * Đơn hàng `/don-hang` (luồng 2, LM-104) — điều phối tạo đơn từ kiện công ty logistics đã quét nhận, rồi gán đơn vào điểm giao của
 * chuyến đang lập kế hoạch. Bố cục V2: dải trời có nút "Tạo đơn hàng", một thẻ gồm thanh tìm / lọc trạng thái và bảng. Menu cuối dòng:
 * sửa, gán vào chuyến / bỏ gán, huỷ có lý do. Quản lý công ty chỉ xem (không có nút ghi). Tìm và lọc giữ trên URL (D-52).
 */
export function OrdersPage() {
  const t = useT()
  const canEdit = useCan()('orders.edit')
  const query = useOrdersQuery()
  const tripsQuery = useAssignableTripsQuery()
  const unassign = useUnassignOrderMutation()
  const list = useListUrlState({ filters: [STATUS_FILTER], defaultSort: { id: 'id', desc: true } })
  const [editing, setEditing] = useState<Editing | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const all = useMemo(() => query.data ?? [], [query.data])
  const rows = useMemo(() => filterOrderRows(all, list.query, list.filters[STATUS_FILTER]), [all, list.query, list.filters])
  const columns = useMemo(() => orderColumns(t, { canEdit }), [t, canEdit])
  const pending = all.filter((row) => row.order.status === 'pending').length
  const statusOptions = ORDER_STATUS_ORDER.map((status) => ({ value: ORDER_STATUS_SLUGS[status], label: t(`orders.status.${status}`) }))

  const planningTripIds = useMemo(() => new Set((tripsQuery.data ?? []).map((trip) => trip.id)), [tripsQuery.data])
  const table = useMemo<OrdersTableContextValue>(() => ({
    canEdit,
    planningTripIds,
    onAction: (action: OrderAction, row: OrderRow) => {
      if (action === 'edit') setEditing({ kind: 'edit', row })
      else if (action === 'assign') setAssigning(row.order.id)
      else if (action === 'cancel') setCancelling(row.order.id)
      else {
        unassign.mutate(row.order.id, {
          onSuccess: () => toast.success(t('orders.assign.unassigned', { id: row.order.id })),
          onError: (error) => toast.error(dataErrorMessage(error, t)),
        })
      }
    },
  }), [canEdit, planningTripIds, unassign, t])

  const createButton = canEdit ? (
    <Button onClick={() => setEditing({ kind: 'create' })}>
      <Plus strokeWidth={1.5} />
      {t('orders.add')}
    </Button>
  ) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={all.length > 0}
        title={t('orders.title')}
        meta={query.isSuccess && all.length > 0 ? t('orders.pendingCount', { count: pending }) : undefined}
        description={t('pageHero.orders')}
        actions={all.length > 0 ? createButton : null}
      />

      <div className={all.length > 0 ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {query.isPending ? (
          <div role="status" aria-label={t('orders.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : query.isError ? (
          <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
        ) : all.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t('orders.empty')} description={t('orders.emptyDescription')} action={createButton ?? undefined} />
        ) : (
          <div className="flex flex-col gap-3">
            <section className="relative flex-none overflow-hidden rounded-lg border border-border bg-bg shadow-card">
              <FilterBar
                layout="toolbar"
                className="min-h-14 border-b border-border px-4 py-2"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('orders.search')}
                fields={[{ kind: 'select', name: STATUS_FILTER, label: t('orders.columns.status'), options: statusOptions }]}
                values={list.filters}
                onValueChange={list.setFilter}
                onClear={list.clearAll}
              />
              <OrdersTableContext value={table}>
                <DataTable
                  data={rows}
                  columns={columns}
                  getRowId={(row) => row.order.id}
                  density="roomy"
                  appearance="paper"
                  sorting={list.sorting}
                  onSortingChange={list.setSorting}
                  pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                  isFiltering={list.isFiltering}
                  onClearFilters={list.clearAll}
                />
              </OrdersTableContext>
            </section>
            <p className="text-caption text-ink-3">{t('orders.sourceNote')}</p>
          </div>
        )}
      </div>

      {canEdit ? (
        <>
          <OrderFormDialog
            open={editing !== null}
            onOpenChange={(open) => { if (!open) setEditing(null) }}
            order={editing?.kind === 'edit' ? editing.row : undefined}
          />
          <OrderAssignDialog open={assigning !== null} onOpenChange={(open) => { if (!open) setAssigning(null) }} orderId={assigning ?? undefined} />
          <CancelOrderDialog orderId={cancelling} onClose={() => setCancelling(null)} />
        </>
      ) : null}
    </div>
  )
}
