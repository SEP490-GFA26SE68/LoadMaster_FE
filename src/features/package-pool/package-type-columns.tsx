import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { Pencil, Trash2 } from 'lucide-react'
import { createContext, use } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { PackageType } from '@/lib/mock-db'

/** Một dòng danh mục: loại kiện kèm số kiện của công ty đang dùng nó. */
export type PackageTypeRow = PackageType & { readonly usage: number }

/**
 * Thao tác của dòng đi qua context: TanStack Table v9 dựng hàm `cell` như component, nên hàm ô khai một lần ở cấp module và phần
 * thay đổi (callback) đọc qua đây — dựng lại cột không gỡ nút đang được bấm (AGENTS mục 5, bảng dữ liệu).
 */
export const PackageTypeActionsContext = createContext<{ onEdit: (row: PackageTypeRow) => void; onDelete: (row: PackageTypeRow) => void } | null>(null)

const helper = createColumnHelper<BaseTableFeatures, PackageTypeRow>()
type Cell<TValue> = CellContext<BaseTableFeatures, PackageTypeRow, TValue>
const mono = 'font-mono text-caption text-ink-1 tabular-nums'

function NameCell({ row }: { row: PackageTypeRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="line-clamp-2 font-medium text-ink-strong">{row.name}</span>
      {' '}
      <span className="font-mono text-caption text-ink-3">{row.id}</span>
    </span>
  )
}

function MeasureCell({ row }: { row: PackageTypeRow }) {
  const format = useFormat()
  return <span className={mono}>{format.dimensions(row.lengthCm, row.widthCm, row.heightCm)}</span>
}

function WeightCell({ value }: { value: number }) {
  const format = useFormat()
  return <span className={mono}>{format.weight(value)}</span>
}

function FragilityCell({ row }: { row: PackageTypeRow }) {
  const t = useT()
  const level = row.fragilityLevel
  const tone = level === 'HIGH' ? 'danger' : level === 'MEDIUM' ? 'warning' : 'neutral'
  return <Badge shape="tag" tone={tone}>{t(`trips.form.fragilityLevels.${level}`)}</Badge>
}

function HandlingCell({ row }: { row: PackageTypeRow }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-col whitespace-normal text-ink-1">
      <span>{t('sourcing.packageTypes.orientationCount', { count: row.allowedOrientations.length })}</span>
      {row.keepUpright ? <span className="text-caption text-ink-3">{t('sourcing.packageTypes.upright')}</span> : null}
    </span>
  )
}

function StackCell({ row }: { row: PackageTypeRow }) {
  const t = useT()
  const format = useFormat()
  if (!row.stackable) return <span className="text-ink-3">{t('sourcing.packageTypes.stackNone')}</span>
  return (
    <span className="flex min-w-0 flex-col whitespace-normal text-ink-1">
      <span>{row.maxStackCount === undefined ? t('sourcing.packageTypes.stackUnlimited') : t('sourcing.packageTypes.stackMax', { count: row.maxStackCount })}</span>
      <span className="text-caption text-ink-3">{t('sourcing.packageTypes.topLoad', { weight: format.weight(row.maxTopLoadKg) })}</span>
    </span>
  )
}

function UsageCell({ value }: { value: number }) {
  const t = useT()
  return <span className={value > 0 ? 'text-ink-1' : 'text-ink-3'}>{t('sourcing.packageTypes.usage', { count: value })}</span>
}

function ActionsCell({ row }: { row: PackageTypeRow }) {
  const t = useT()
  const actions = use(PackageTypeActionsContext)
  if (!actions) return null
  const reason = t('sourcing.packageTypes.inUse', { count: row.usage })
  return (
    <span className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" aria-label={t('sourcing.packageTypes.edit', { name: row.name })} onClick={() => actions.onEdit(row)}>
        <Pencil strokeWidth={1.5} />
      </Button>
      {row.usage > 0 ? (
        // Luật chặn hiện ngay tại chỗ (AGENTS mục 5): nút mờ, lý do ở tooltip và trong tên truy cập của ô bọc
        <Tooltip>
          <TooltipTrigger asChild>
            <span role="button" aria-disabled tabIndex={0} aria-label={`${t('sourcing.packageTypes.delete', { name: row.name })}. ${reason}`} className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <Button variant="ghost" size="icon" disabled tabIndex={-1} aria-hidden>
                <Trash2 strokeWidth={1.5} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
      ) : (
        <Button variant="ghost" size="icon" aria-label={t('sourcing.packageTypes.delete', { name: row.name })} onClick={() => actions.onDelete(row)}>
          <Trash2 strokeWidth={1.5} />
        </Button>
      )}
    </span>
  )
}

function ActionsHeader() {
  const t = useT()
  return <span className="sr-only">{t('sourcing.packageTypes.columns.actions')}</span>
}

const nameCell = (info: Cell<string>) => <NameCell row={info.row.original} />
const measureCell = (info: Cell<number>) => <MeasureCell row={info.row.original} />
const weightCell = (info: Cell<number>) => <WeightCell value={info.getValue()} />
const fragilityCell = (info: Cell<unknown>) => <FragilityCell row={info.row.original} />
const handlingCell = (info: Cell<unknown>) => <HandlingCell row={info.row.original} />
const stackCell = (info: Cell<unknown>) => <StackCell row={info.row.original} />
const usageCell = (info: Cell<number>) => <UsageCell value={info.getValue()} />
const actionsCell = (info: Cell<unknown>) => <ActionsCell row={info.row.original} />
const actionsHeader = () => <ActionsHeader />

/** Cột danh mục loại kiện. Chỉ dựng lại khi đổi ngôn ngữ; `canEdit` bỏ cột thao tác. */
export function packageTypeColumns(t: TFunction, canEdit: boolean) {
  return helper.columns([
    helper.accessor('name', { header: t('sourcing.packageTypes.columns.name'), enableSorting: true, cell: nameCell }),
    helper.accessor('lengthCm', {
      header: t('sourcing.packageTypes.columns.dimensions'),
      meta: { align: 'right', width: '190px' } satisfies ColumnMeta,
      cell: measureCell,
    }),
    helper.accessor('weightKg', {
      header: t('sourcing.packageTypes.columns.weight'),
      enableSorting: true,
      meta: { align: 'right', width: '130px' } satisfies ColumnMeta,
      cell: weightCell,
    }),
    helper.display({ id: 'fragility', header: t('sourcing.packageTypes.columns.fragility'), meta: { width: '110px' } satisfies ColumnMeta, cell: fragilityCell }),
    helper.display({ id: 'handling', header: t('sourcing.packageTypes.columns.handling'), meta: { width: '150px' } satisfies ColumnMeta, cell: handlingCell }),
    helper.display({ id: 'stack', header: t('sourcing.packageTypes.columns.stack'), meta: { width: '180px' } satisfies ColumnMeta, cell: stackCell }),
    helper.accessor('usage', {
      header: t('sourcing.packageTypes.columns.usage'),
      enableSorting: true,
      sortDescFirst: true,
      meta: { width: '180px' } satisfies ColumnMeta,
      cell: usageCell,
    }),
    ...(canEdit ? [helper.display({ id: 'actions', header: actionsHeader, meta: { width: '96px', align: 'right' } satisfies ColumnMeta, cell: actionsCell })] : []),
  ])
}
