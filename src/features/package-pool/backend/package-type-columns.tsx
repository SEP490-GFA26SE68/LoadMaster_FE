
import {
  createColumnHelper,
  type CellContext,
} from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'
import { createContext, use } from 'react'

import {
  type BaseTableFeatures,
  type ColumnMeta,
} from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  useFormat,
  useT,
  type TFunction,
} from '@/lib/i18n'

import type { PackageType } from './package-types-api'

/**
 * Một dòng danh mục loại kiện.
 * Dữ liệu lấy trực tiếp từ BE.
 */
export type PackageTypeRow = PackageType

export const PackageTypeActionsContext = createContext<{
  onEdit: (row: PackageTypeRow) => void
  onDelete: (row: PackageTypeRow) => void
} | null>(null)

const helper = createColumnHelper<
  BaseTableFeatures,
  PackageTypeRow
>()

type Cell<TValue> = CellContext<
  BaseTableFeatures,
  PackageTypeRow,
  TValue
>

const mono = 'font-mono text-caption text-ink-1 tabular-nums'

function NameCell({ row }: { row: PackageTypeRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="line-clamp-2 font-medium text-ink-strong">
        {row.name}
      </span>

      <span className="font-mono text-caption text-ink-3">
        {row.typeCode || `#${row.id}`}
      </span>
    </span>
  )
}

function MeasureCell({ row }: { row: PackageTypeRow }) {
  const format = useFormat()

  return (
    <span className={mono}>
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
    <span className={mono}>
      {format.weight(value)}
    </span>
  )
}

function FragilityCell({ row }: { row: PackageTypeRow }) {
  const t = useT()

  return (
    <Badge
      shape="tag"
      tone={row.isFragile ? 'warning' : 'neutral'}
    >
      {row.isFragile
        ? t('sourcing.packageTypes.fragile')
        : t('sourcing.packageTypes.notFragile')}
    </Badge>
  )
}

function HandlingCell({ row }: { row: PackageTypeRow }) {
  const t = useT()

  const allowedAxes = [
    row.allowRotateX,
    row.allowRotateY,
    row.allowRotateZ,
  ].filter(Boolean).length

  return (
    <span className="flex min-w-0 flex-col whitespace-normal text-ink-1">
      {row.rotationAllowed
        ? (
          <span>
            {t('sourcing.packageTypes.rotationAxes')}: {allowedAxes}/3
          </span>
        )
        : t('sourcing.packageTypes.noRotation')}
    </span>
  )
}

function StackCell({ row }: { row: PackageTypeRow }) {
  const t = useT()
  const format = useFormat()

  return (
    <span className="flex min-w-0 flex-col whitespace-normal text-ink-1">
      <span>
        {row.maxStackWeightKg === 0
          ? t('sourcing.packageTypes.stackNone')
          : t('sourcing.packageTypes.topLoad', {
              weight: format.weight(row.maxStackWeightKg),
            })}
      </span>
    </span>
  )
}

function ActionsCell({ row }: { row: PackageTypeRow }) {
  const t = useT()
  const actions = use(PackageTypeActionsContext)

  if (!actions) return null

  return (
    <span className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('sourcing.packageTypes.edit', {
          name: row.name,
        })}
        onClick={() => actions.onEdit(row)}
      >
        <Pencil strokeWidth={1.5} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label={t('sourcing.packageTypes.delete', {
          name: row.name,
        })}
        onClick={() => actions.onDelete(row)}
      >
        <Trash2 strokeWidth={1.5} />
      </Button>
    </span>
  )
}

function ActionsHeader() {
  const t = useT()

  return (
    <span className="sr-only">
      {t('sourcing.packageTypes.columns.actions')}
    </span>
  )
}

const nameCell = (info: Cell<string>) => (
  <NameCell row={info.row.original} />
)

const measureCell = (info: Cell<number>) => (
  <MeasureCell row={info.row.original} />
)

const weightCell = (info: Cell<number>) => (
  <WeightCell value={info.getValue()} />
)

const fragilityCell = (info: Cell<unknown>) => (
  <FragilityCell row={info.row.original} />
)

const handlingCell = (info: Cell<unknown>) => (
  <HandlingCell row={info.row.original} />
)

const stackCell = (info: Cell<unknown>) => (
  <StackCell row={info.row.original} />
)

const actionsCell = (info: Cell<unknown>) => (
  <ActionsCell row={info.row.original} />
)

const actionsHeader = () => <ActionsHeader />

/**
 * Cột danh mục loại kiện.
 * canEdit = false sẽ ẩn cột thao tác.
 */
export function packageTypeColumns(
  t: TFunction,
  canEdit: boolean,
) {
  return helper.columns([
    helper.accessor('name', {
      header: t('sourcing.packageTypes.columns.name'),
      enableSorting: true,
      cell: nameCell,
    }),

    helper.accessor('lengthCm', {
      header: t('sourcing.packageTypes.columns.dimensions'),
      meta: {
        align: 'right',
        width: '190px',
      } satisfies ColumnMeta,
      cell: measureCell,
    }),

    helper.accessor('weightKg', {
      header: t('sourcing.packageTypes.columns.weight'),
      enableSorting: true,
      meta: {
        align: 'right',
        width: '130px',
      } satisfies ColumnMeta,
      cell: weightCell,
    }),

    helper.display({
      id: 'fragility',
      header: t('sourcing.packageTypes.columns.fragility'),
      meta: {
        width: '130px',
      } satisfies ColumnMeta,
      cell: fragilityCell,
    }),

    helper.display({
      id: 'handling',
      header: t('sourcing.packageTypes.columns.handling'),
      meta: {
        width: '170px',
      } satisfies ColumnMeta,
      cell: handlingCell,
    }),

    helper.display({
      id: 'stack',
      header: t('sourcing.packageTypes.columns.stack'),
      meta: {
        width: '180px',
      } satisfies ColumnMeta,
      cell: stackCell,
    }),

    ...(canEdit
      ? [
          helper.display({
            id: 'actions',
            header: actionsHeader,
            meta: {
              width: '96px',
              align: 'right',
            } satisfies ColumnMeta,
            cell: actionsCell,
          }),
        ]
      : []),
  ])
}
