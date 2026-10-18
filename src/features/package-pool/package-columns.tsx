import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { createContext, use } from 'react'

import type {
  BaseTableFeatures,
  ColumnMeta,
} from '@/components/DataTable'

import { HandlingClassChip } from '@/components/HandlingClassChip'
import { Badge } from '@/components/ui/Badge'
import { useFormat, type TFunction } from '@/lib/i18n'

import type { CargoPackageRow } from './packages-list'

export type PackageTableState = {
  readonly openId: string | null
  readonly onOpen: (id: string) => void
  readonly panelId: string
}

export const PackageTableContext =
  createContext<PackageTableState | null>(null)

function useTableState(): PackageTableState {
  const value = use(PackageTableContext)

  if (!value) {
    throw new Error(
      'PackageTableContext is missing',
    )
  }

  return value
}

export function packageOpenButtonId(id: string) {
  return `package-open-${id}`
}

const helper = createColumnHelper<
  BaseTableFeatures,
  CargoPackageRow
>()

type Cell<TValue> =
  CellContext<BaseTableFeatures, CargoPackageRow, TValue>

const STATUS_LABELS: Record<
  CargoPackageRow['status'],
  string
> = {
  PENDING: 'Chờ xử lý',
  PLANNED: 'Đã lập kế hoạch',
  LOADED: 'Đã xếp xe',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
}

function CodeCell({ row }: { row: CargoPackageRow }) {
  const { openId, onOpen, panelId } = useTableState()

  const open = row.id === openId

  return (
    <span className="flex min-w-0 flex-col items-start whitespace-normal">
      <button
        type="button"
        id={packageOpenButtonId(row.id)}
        aria-pressed={open}
        aria-controls={open ? panelId : undefined}
        onClick={(event) => {
          event.stopPropagation()
          onOpen(row.id)
        }}
        className="max-w-full cursor-pointer truncate rounded-sm text-left font-mono text-body font-medium text-ink-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {row.packageCode || `PKG-${row.id}`}
      </button>


    </span>
  )
}

function PackageTypeCell({
  row,
}: {
  row: CargoPackageRow
}) {
  if (!row.type) {
    return (
      <span className="text-ink-3">
        Không có loại kiện
      </span>
    )
  }

  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="text-ink-1">
        {row.type.name}
      </span>

      {row.type.typeCode ? (
        <span className="font-mono text-caption text-ink-3">
          {row.type.typeCode}
        </span>
      ) : null}
    </span>
  )
}


function RequirementCell({
  row,
}: {
  row: CargoPackageRow
}) {
  if (!row.deliveryRequirementId) {
    return (
      <span className="text-sm text-ink-3">
        Chưa có yêu cầu giao
      </span>
    )
  }

  const received = row.receivedPackageCount
  const expected = row.expectedPackageCount

  const isOverExpected =
    received != null &&
    expected != null &&
    received > expected

  return (
    <div className="flex min-w-0 flex-col gap-1 whitespace-normal">
      <span className="font-medium text-ink-strong">
        {row.customerName || 'Chưa có tên khách hàng'}
      </span>

      <span className="text-xs text-ink-3">
        Yêu cầu giao #{row.deliveryRequirementId}
      </span>

      <span
        className={
          isOverExpected
            ? 'text-xs font-semibold text-amber-600'
            : 'text-xs text-ink-2'
        }
      >
        Đã nhận: {received ?? '—'}
        /{expected ?? '—'} kiện
        {isOverExpected ? ' · Vượt dự kiến' : ''}
      </span>
    </div>
  )
}


function DimensionsCell({
  row,
}: {
  row: CargoPackageRow
}) {
  const format = useFormat()

  return (
    <span className="font-mono text-caption text-ink-1 tabular-nums">
      {format.dimensions(
        row.lengthCm,
        row.widthCm,
        row.heightCm,
      )}
    </span>
  )
}

function WeightCell({ value }: { value: number }) {
  const format = useFormat()

  return (
    <span className="font-mono text-caption text-ink-1 tabular-nums">
      {format.weight(value)}
    </span>
  )
}

function StatusCell({
  status,
}: {
  status: CargoPackageRow['status']
}) {
  const label = STATUS_LABELS[status]

  return (
    <Badge>
      {label}
    </Badge>
  )
}

const codeCell = (info: Cell<string>) => (
  <CodeCell row={info.row.original} />
)

const typeCell = (info: Cell<unknown>) => (
  <PackageTypeCell row={info.row.original} />
)

const requirementCell = (info: Cell<unknown>) => (
  <RequirementCell row={info.row.original} />
)

const dimensionsCell = (info: Cell<unknown>) => (
  <DimensionsCell row={info.row.original} />
)

const weightCell = (info: Cell<number>) => (
  <WeightCell value={info.getValue()} />
)

const classCell = (
  info: Cell<CargoPackageRow['handlingClass']>,
) => (
  <HandlingClassChip
    handlingClass={info.getValue()}
  />
)

const destinationCell = (info: Cell<string>) => (
  <span className="line-clamp-2 whitespace-normal text-ink-1">
    {info.getValue()}
  </span>
)

const statusCell = (
  info: Cell<CargoPackageRow['status']>,
) => (
  <StatusCell status={info.getValue()} />
)

export function packageColumns(
  t: TFunction,
  {
    panelOpen,
  }: {
    panelOpen: boolean
  },
) {
  const label = (
    key:
      | 'code'
      | 'packageType'
      | 'dimensions'
      | 'weight'
      | 'handlingClass'
      | 'destination'
      | 'status',
  ) => t(`sourcing.packages.columns.${key}`)

  return helper.columns([
    helper.accessor('packageCode', {
      id: 'code',
      header: label('code'),
      enableSorting: true,
      meta: {
        width: '178px',
      } satisfies ColumnMeta,
      cell: codeCell,
    }),


    helper.display({
      id: 'deliveryRequirement',
      header: 'Khách hàng / Yêu cầu giao',
      enableSorting: false,
      meta: {
        width: '240px',
      } satisfies ColumnMeta,
      cell: requirementCell,
    }),


    helper.display({
      id: 'packageType',
      header: label('packageType'),
      meta: {
        width: '180px',
      } satisfies ColumnMeta,
      cell: typeCell,
    }),

    ...(panelOpen
      ? []
      : [
        helper.display({
          id: 'dimensions',
          header: label('dimensions'),
          meta: {
            width: '156px',
          } satisfies ColumnMeta,
          cell: dimensionsCell,
        }),

        helper.accessor('weightKg', {
          id: 'weight',
          header: label('weight'),
          enableSorting: true,
          meta: {
            width: '128px',
            align: 'right',
          } satisfies ColumnMeta,
          cell: weightCell,
        }),
      ]),

    helper.accessor('handlingClass', {
      header: label('handlingClass'),
      meta: {
        width: '132px',
      } satisfies ColumnMeta,
      cell: classCell,
    }),

    helper.accessor('destination', {
      header: label('destination'),
      enableSorting: true,
      cell: destinationCell,
    }),

    helper.accessor('status', {
      header: label('status'),
      meta: {
        width: '156px',
      } satisfies ColumnMeta,
      cell: statusCell,
    }),
  ])
}