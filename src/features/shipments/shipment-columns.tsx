import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { Link } from 'react-router'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { ShipmentStatus } from '@/lib/mock-db'
import type { ShipmentRow } from './shipments-api'
import { ReceiptMeter, ShipmentStatusBadge } from './shipment-look'

const helper = createColumnHelper<BaseTableFeatures, ShipmentRow>()
type Cell<TValue> = CellContext<BaseTableFeatures, ShipmentRow, TValue>

/** Thứ tự trạng thái khi sắp xếp: theo tiến trình của lô. */
const STATUS_RANK: Record<ShipmentStatus, number> = { draft: 0, handed_over: 1, partially_received: 2, received: 3 }

function CodeCell({ row }: { row: ShipmentRow }) {
  return (
    <Link
      to={`/lo-hang/${row.shipment.id}`}
      onClick={(event) => event.stopPropagation()}
      className="rounded-sm font-mono text-body font-medium text-ink-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {row.shipment.id}
    </Link>
  )
}

function LogisticsCell({ row }: { row: ShipmentRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="line-clamp-1 text-ink-1">{row.logistics?.name ?? row.shipment.logisticsCompanyId}</span>
      {row.shipment.note ? <><span className="sr-only"> </span><span className="line-clamp-1 text-caption text-ink-3">{row.shipment.note}</span></> : null}
    </span>
  )
}

function CountCell({ value }: { value: number }) {
  const format = useFormat()
  return <span className="font-mono text-caption text-ink-1 tabular-nums">{format.integer(value)}</span>
}

function ReceivedCell({ row }: { row: ShipmentRow }) {
  const t = useT()
  const format = useFormat()
  const count = row.shipment.packageIds.length
  return (
    <span className="flex items-center gap-2.5">
      <ReceiptMeter received={row.receivedCount} count={count} />
      <span className="font-mono text-caption text-ink-1 tabular-nums">
        {t('sourcing.shipments.receivedOf', { received: format.integer(row.receivedCount), count: format.integer(count) })}
      </span>
    </span>
  )
}

function DateCell({ value }: { value: string }) {
  const format = useFormat()
  return <span className="font-mono text-caption text-ink-1 tabular-nums">{format.date(value)}</span>
}

const codeCell = (info: Cell<string>) => <CodeCell row={info.row.original} />
const logisticsCell = (info: Cell<string>) => <LogisticsCell row={info.row.original} />
const countCell = (info: Cell<number>) => <CountCell value={info.getValue()} />
const receivedCell = (info: Cell<number>) => <ReceivedCell row={info.row.original} />
const statusCell = (info: Cell<number>) => <ShipmentStatusBadge status={info.row.original.shipment.status} />
const dateCell = (info: Cell<string>) => <DateCell value={info.getValue()} />

/** Cột danh sách lô: mã lô · công ty logistics (+ ghi chú) · số kiện · đã nhận x / y · trạng thái · ngày tạo. */
export function shipmentColumns(t: TFunction) {
  return helper.columns([
    helper.accessor((row) => row.shipment.id, { id: 'id', header: t('sourcing.shipments.columns.code'), enableSorting: true, meta: { width: '130px' } satisfies ColumnMeta, cell: codeCell }),
    helper.accessor((row) => row.logistics?.name ?? row.shipment.logisticsCompanyId, { id: 'logistics', header: t('sourcing.shipments.columns.logistics'), enableSorting: true, cell: logisticsCell }),
    helper.accessor((row) => row.shipment.packageIds.length, {
      id: 'packages',
      header: t('sourcing.shipments.columns.packages'),
      enableSorting: true,
      meta: { width: '110px', align: 'right' } satisfies ColumnMeta,
      cell: countCell,
    }),
    helper.accessor('receivedCount', { header: t('sourcing.shipments.columns.received'), meta: { width: '170px' } satisfies ColumnMeta, cell: receivedCell }),
    helper.accessor((row) => STATUS_RANK[row.shipment.status], {
      id: 'status',
      header: t('sourcing.shipments.columns.status'),
      enableSorting: true,
      meta: { width: '170px' } satisfies ColumnMeta,
      cell: statusCell,
    }),
    helper.accessor((row) => row.shipment.createdAt, {
      id: 'createdAt',
      header: t('sourcing.shipments.columns.createdAt'),
      enableSorting: true,
      sortDescFirst: true,
      meta: { width: '130px', align: 'right' } satisfies ColumnMeta,
      cell: dateCell,
    }),
  ])
}
