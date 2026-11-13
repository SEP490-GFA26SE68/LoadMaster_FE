import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { createContext, use } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { useT } from '@/lib/i18n'
import type { CargoPackageRow } from './packages-list'

/**
 * Cột chọn kiện của bảng kho kiện máy chủ. Ô và tiêu đề khai **một lần ở cấp module** (AGENTS.md mục 5 "Bảng dữ liệu"): TanStack Table v9
 * dựng mỗi hàm ô thành một component, nên khai trong `useMemo` theo tập đã chọn thì mỗi lần bấm ô chọn gỡ rồi gắn lại mọi ô của bảng (mất
 * focus bàn phím sau phím Space). Tập đã chọn đi qua context — đổi tập chỉ vẽ lại ô chọn.
 */
export type PackageSelectionState = {
  readonly selectedIds: ReadonlySet<string>
  readonly allPageSelected: boolean
  readonly somePageSelected: boolean
  readonly toggle: (id: string, checked: boolean) => void
  readonly togglePage: (checked: boolean) => void
}

export const PackageSelectionContext = createContext<PackageSelectionState | null>(null)

function useSelection(): PackageSelectionState {
  const value = use(PackageSelectionContext)
  if (!value) throw new Error('Thiếu PackageSelectionContext')
  return value
}

function SelectPageHeader() {
  const t = useT()
  const { allPageSelected, somePageSelected, togglePage } = useSelection()
  return (
    <input
      type="checkbox"
      aria-label={t('sourcing.server.selectAll')}
      checked={allPageSelected}
      ref={(element) => {
        if (element) element.indeterminate = somePageSelected && !allPageSelected
      }}
      onChange={(event) => togglePage(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
  )
}

function SelectPackageCell({ row }: CellContext<BaseTableFeatures, CargoPackageRow, unknown>) {
  const t = useT()
  const { selectedIds, toggle } = useSelection()
  const pkg = row.original
  return (
    <input
      type="checkbox"
      aria-label={t('sourcing.server.selectPackage', { code: pkg.packageCode })}
      checked={selectedIds.has(pkg.id)}
      onChange={(event) => toggle(pkg.id, event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
  )
}

const helper = createColumnHelper<BaseTableFeatures, CargoPackageRow>()

export const selectionColumn = helper.display({
  id: 'select',
  header: SelectPageHeader,
  cell: SelectPackageCell,
  enableSorting: false,
  meta: { width: '48px' } satisfies ColumnMeta,
})
