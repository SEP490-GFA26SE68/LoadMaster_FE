import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { createContext, use } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Checkbox } from '@/components/ui/Checkbox'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { PackageStatusBadge, TypeMeasure } from './package-look'
import type { PackageRow } from './packages-list'

/**
 * Chọn kiện trong bảng (in nhãn). Hàm ô khai ở cấp module, lựa chọn đi qua context (AGENTS mục 5): chọn một kiện không
 * dựng lại cột, checkbox đang được bấm không bị gỡ khỏi DOM.
 */
export type PackageSelection = {
  readonly selected: ReadonlySet<string>
  readonly toggle: (id: string, checked: boolean) => void
  /** Kiện khớp bộ lọc — ô chọn ở tiêu đề chọn / bỏ cả nhóm này. */
  readonly visibleIds: readonly string[]
  readonly setMany: (ids: readonly string[], checked: boolean) => void
}

export const PackageSelectionContext = createContext<PackageSelection | null>(null)

function useSelection(): PackageSelection {
  const value = use(PackageSelectionContext)
  if (!value) throw new Error('Ô chọn kiện phải nằm trong <PackageSelectionContext>')
  return value
}

const helper = createColumnHelper<BaseTableFeatures, PackageRow>()
type Cell<TValue> = CellContext<BaseTableFeatures, PackageRow, TValue>

function SelectHeader() {
  const t = useT()
  const { selected, visibleIds, setMany } = useSelection()
  const all = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  return (
    <Checkbox
      aria-label={t('sourcing.packages.selectAll')}
      checked={all}
      disabled={visibleIds.length === 0}
      onCheckedChange={(checked) => setMany(visibleIds, checked === true)}
    />
  )
}

function SelectCell({ id }: { id: string }) {
  const t = useT()
  const { selected, toggle } = useSelection()
  return (
    <span onClick={(event) => event.stopPropagation()} className="flex">
      <Checkbox aria-label={t('sourcing.packages.selectRow', { id })} checked={selected.has(id)} onCheckedChange={(checked) => toggle(id, checked === true)} />
    </span>
  )
}

function CodeCell({ row }: { row: PackageRow }) {
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="font-mono text-body font-medium text-ink-strong">{row.id}</span>
      {row.reference ? <><span className="sr-only"> </span><span className="truncate font-mono text-caption text-ink-3">{row.reference}</span></> : null}
    </span>
  )
}

function TypeCell({ row }: { row: PackageRow }) {
  const t = useT()
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="line-clamp-1 text-ink-1">{row.type?.name ?? t('sourcing.labels.unknownType', { id: row.packageTypeId })}</span>
      {row.type ? <TypeMeasure type={row.type} /> : null}
    </span>
  )
}

function DateCell({ value }: { value: string }) {
  const format = useFormat()
  return <span className="font-mono text-caption text-ink-1 tabular-nums">{format.date(value)}</span>
}

const selectHeader = () => <SelectHeader />
const selectCell = (info: Cell<unknown>) => <SelectCell id={info.row.original.id} />
const codeCell = (info: Cell<string>) => <CodeCell row={info.row.original} />
const typeCell = (info: Cell<unknown>) => <TypeCell row={info.row.original} />
const statusCell = (info: Cell<PackageRow['status']>) => <PackageStatusBadge status={info.getValue()} />
const qrCell = (info: Cell<string>) => <span className="font-mono text-caption text-ink-2">{info.getValue()}</span>
const dateCell = (info: Cell<string>) => <DateCell value={info.getValue()} />

/** Cột bảng kiện: chọn · mã kiện (+ mã lô / SKU) · loại kiện (+ số đo) · trạng thái · mã QR · ngày đăng ký. */
export function packageColumns(t: TFunction) {
  return helper.columns([
    helper.display({ id: 'select', header: selectHeader, meta: { width: '48px' } satisfies ColumnMeta, cell: selectCell }),
    helper.accessor('id', { header: t('sourcing.packages.columns.code'), enableSorting: true, meta: { width: '170px' } satisfies ColumnMeta, cell: codeCell }),
    helper.accessor((row) => row.type?.name ?? row.packageTypeId, { id: 'type', header: t('sourcing.packages.columns.type'), enableSorting: true, cell: typeCell }),
    helper.accessor('status', { header: t('sourcing.packages.columns.status'), meta: { width: '220px' } satisfies ColumnMeta, cell: statusCell }),
    helper.accessor('qrToken', { header: t('sourcing.packages.columns.qr'), meta: { width: '170px' } satisfies ColumnMeta, cell: qrCell }),
    helper.accessor('registeredAt', {
      header: t('sourcing.packages.columns.registeredAt'),
      enableSorting: true,
      sortDescFirst: true,
      meta: { width: '150px', align: 'right' } satisfies ColumnMeta,
      cell: dateCell,
    }),
  ])
}
