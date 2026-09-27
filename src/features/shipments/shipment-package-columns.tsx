import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { CircleCheck } from 'lucide-react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { PackageType, RegisteredPackage, ShipmentReceipt } from '@/lib/mock-db'

/** Một kiện trong lô kèm loại kiện và lần quét nhận (nếu đã nhận). */
export type ShipmentPackageRow = {
  readonly package: RegisteredPackage
  readonly type: PackageType | undefined
  readonly receipt: ShipmentReceipt | undefined
}

const helper = createColumnHelper<BaseTableFeatures, ShipmentPackageRow>()
type Cell<TValue> = CellContext<BaseTableFeatures, ShipmentPackageRow, TValue>

function CodeCell({ row }: { row: ShipmentPackageRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="font-mono text-body font-medium text-ink-strong">{row.package.id}</span>
      {row.package.reference ? <><span className="sr-only"> </span><span className="truncate font-mono text-caption text-ink-3">{row.package.reference}</span></> : null}
    </span>
  )
}

function MeasureCell({ type }: { type: PackageType | undefined }) {
  const t = useT()
  const format = useFormat()
  if (!type) return null
  return (
    <span className="font-mono text-caption text-ink-1 tabular-nums">
      {t('sourcing.register.typeSummary', { dimensions: format.dimensions(type.lengthCm, type.widthCm, type.heightCm), weight: format.weight(type.weightKg) })}
    </span>
  )
}

function ReceivedCell({ receipt }: { receipt: ShipmentReceipt | undefined }) {
  const t = useT()
  const format = useFormat()
  if (!receipt) return <span className="text-ink-3">{t('sourcing.shipments.detail.notReceived')}</span>
  return (
    <span className="flex items-center gap-1.5 text-success">
      <CircleCheck aria-hidden className="size-4 flex-none" strokeWidth={1.5} />
      {t('sourcing.shipments.detail.receivedAt', { time: `${format.time(receipt.at)} ${format.dayMonth(receipt.at)}` })}
    </span>
  )
}

const codeCell = (info: Cell<string>) => <CodeCell row={info.row.original} />
const typeCell = (info: Cell<string>) => <span className="line-clamp-2 whitespace-normal text-ink-1">{info.getValue()}</span>
const measureCell = (info: Cell<unknown>) => <MeasureCell type={info.row.original.type} />
const qrCell = (info: Cell<string>) => <span className="font-mono text-caption text-ink-2">{info.getValue()}</span>
const receivedCell = (info: Cell<string>) => <ReceivedCell receipt={info.row.original.receipt} />

/** Cột kiện trong lô: mã kiện · loại kiện · kích thước · mã QR · nhận ở kho. */
export function shipmentPackageColumns(t: TFunction) {
  return helper.columns([
    helper.accessor((row) => row.package.id, { id: 'id', header: t('sourcing.shipments.detail.columns.code'), enableSorting: true, meta: { width: '160px' } satisfies ColumnMeta, cell: codeCell }),
    helper.accessor((row) => row.type?.name ?? row.package.packageTypeId, { id: 'type', header: t('sourcing.shipments.detail.columns.type'), enableSorting: true, cell: typeCell }),
    helper.display({ id: 'measure', header: t('sourcing.shipments.detail.columns.dimensions'), meta: { width: '190px' } satisfies ColumnMeta, cell: measureCell }),
    helper.accessor((row) => row.package.qrToken, { id: 'qr', header: t('sourcing.shipments.detail.columns.qr'), meta: { width: '170px' } satisfies ColumnMeta, cell: qrCell }),
    helper.accessor((row) => row.receipt?.at ?? '', {
      id: 'received',
      header: t('sourcing.shipments.detail.columns.received'),
      enableSorting: true,
      meta: { width: '210px' } satisfies ColumnMeta,
      cell: receivedCell,
    }),
  ])
}
