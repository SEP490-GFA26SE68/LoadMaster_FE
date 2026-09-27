import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { Link } from 'react-router'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import type { OrderStatus } from '@/lib/mock-db'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { OrderRow } from './orders-api'
import { ORDER_STATUS_ORDER } from './order-list'
import { OrderRowMenu } from './OrderRowMenu'
import { OrderStatusBadge } from './OrderStatusBadge'

const helper = createColumnHelper<BaseTableFeatures, OrderRow>()
type Cell<TValue> = CellContext<BaseTableFeatures, OrderRow, TValue>

/*
 * Hàm `cell` khai ở mức module: TanStack Table v9 dựng ô như component, hàm mới là gỡ và gắn lại ô — kể cả menu thao tác đang mở
 * (AGENTS mục 5). Phần thay đổi (quyền, thao tác) đọc qua `OrdersTableContext`.
 */

function OrderCell({ row }: { row: OrderRow }) {
  const t = useT()
  const format = useFormat()
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-mono text-caption font-medium text-ink-strong">{row.order.id}</span>
      {' '}
      <span className="text-note text-ink-3">{t('orders.createdAt', { date: format.date(row.order.createdAt) })}</span>
    </span>
  )
}

function CustomerCell({ row }: { row: OrderRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="line-clamp-1 font-medium text-ink-strong">{row.order.customerName}</span>
      {' '}
      <span className="line-clamp-1 text-small text-ink-3">{row.order.deliveryAddress}</span>
    </span>
  )
}

function PackagesCell({ row }: { row: OrderRow }) {
  const t = useT()
  const names = [...new Set(row.packages.map((item) => item.type?.name).filter((name) => name !== undefined))]
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="text-ink-1">{t('orders.packageCount', { count: row.packages.length })}</span>
      {' '}
      <span className="line-clamp-1 text-small text-ink-3">{names.join(' · ')}</span>
    </span>
  )
}

function TripCell({ row }: { row: OrderRow }) {
  const t = useT()
  if (!row.trip) return <span className="text-ink-3">{t('orders.notAssigned')}</span>
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <Link
        to={`/chuyen/${row.trip.id}`}
        className="line-clamp-1 rounded-sm font-medium text-ink-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {row.trip.name}
      </Link>
      {' '}
      <span className="font-mono text-caption text-ink-3">
        {row.stopNumber === undefined ? row.trip.id : `${row.trip.id} · ${t('orders.stop', { number: row.stopNumber })}`}
      </span>
    </span>
  )
}

function WeightCell({ value }: { value: number }) {
  const format = useFormat()
  return <span className="font-mono text-caption text-ink-1">{format.weight(value)}</span>
}

function StatusCell({ row }: { row: OrderRow }) {
  const t = useT()
  const reason = row.order.cancellation?.reason
  return (
    <span className="flex min-w-0 flex-col items-start gap-1 whitespace-normal">
      <OrderStatusBadge status={row.order.status} />
      {reason ? <span className="line-clamp-2 text-note text-ink-3">{t('orders.cancelReason', { reason })}</span> : null}
    </span>
  )
}

function ActionsHeader() {
  const t = useT()
  return <span className="sr-only">{t('orders.columns.actions')}</span>
}

const orderCell = (info: Cell<string>) => <OrderCell row={info.row.original} />
const customerCell = (info: Cell<string>) => <CustomerCell row={info.row.original} />
const packagesCell = (info: Cell<number>) => <PackagesCell row={info.row.original} />
const weightCell = (info: Cell<number>) => <WeightCell value={info.getValue()} />
const statusCell = (info: Cell<number>) => <StatusCell row={info.row.original} />
const tripCell = (info: Cell<string>) => <TripCell row={info.row.original} />
const actionsCell = (info: Cell<unknown>) => <OrderRowMenu row={info.row.original} />

const statusRank = (status: OrderStatus) => ORDER_STATUS_ORDER.indexOf(status)

/**
 * Cột bảng đơn hàng (LM-104): Đơn hàng (mã, ngày tạo) · Khách hàng (tên, địa chỉ) · Kiện (số kiện, loại) · Khối lượng · Trạng thái ·
 * Chuyến / điểm giao · menu (chỉ khi có quyền ghi). Dựng lại khi đổi ngôn ngữ hoặc quyền; hàm ô giữ nguyên.
 */
export function orderColumns(t: TFunction, { canEdit }: { canEdit: boolean }) {
  return helper.columns([
    helper.accessor((row) => row.order.id, { id: 'id', header: t('orders.columns.order'), enableSorting: true, meta: { width: '150px' } satisfies ColumnMeta, cell: orderCell }),
    helper.accessor((row) => row.order.customerName, { id: 'customer', header: t('orders.columns.customer'), enableSorting: true, meta: { width: '30%' } satisfies ColumnMeta, cell: customerCell }),
    helper.accessor((row) => row.packages.length, { id: 'packages', header: t('orders.columns.packages'), enableSorting: true, meta: { width: '20%' } satisfies ColumnMeta, cell: packagesCell }),
    helper.accessor('totalKg', { header: t('orders.columns.weight'), enableSorting: true, meta: { align: 'right', width: '120px' } satisfies ColumnMeta, cell: weightCell }),
    helper.accessor((row) => statusRank(row.order.status), { id: 'status', header: t('orders.columns.status'), enableSorting: true, sortDescFirst: false, meta: { width: '170px' } satisfies ColumnMeta, cell: statusCell }),
    helper.accessor((row) => row.trip?.name ?? '', { id: 'trip', header: t('orders.columns.trip'), enableSorting: true, meta: { width: '22%' } satisfies ColumnMeta, cell: tripCell }),
    ...(canEdit ? [helper.display({ id: 'actions', header: ActionsHeader, meta: { width: '56px', align: 'right' } satisfies ColumnMeta, cell: actionsCell })] : []),
  ])
}
