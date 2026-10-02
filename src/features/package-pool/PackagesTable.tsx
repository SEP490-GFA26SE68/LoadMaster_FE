import { useCallback, useEffect, useId, useMemo, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import { DataTable } from '@/components/DataTable'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import type { ListUrlState } from '@/components/useListUrlState'
import { HANDLING_CLASSES } from '@/domain/models'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { packageColumns, packageOpenButtonId, PackageTableContext, type PackageTableState } from './package-columns'
import { PackageDetailPanel } from './PackageDetailPanel'
import { PackageSelectionBar } from './PackageSelectionBar'
import {
  CLASS_FILTER, FLAG_CHOICES, FLAG_FILTER, FLAG_SLUGS, HANDLING_CLASS_SLUGS, LINK_CHOICES, LINK_FILTER, LINK_SLUGS, NO_FLAG, orderedSelection,
  type PackageFilterName, type PackageRow,
} from './packages-list'

/**
 * Thẻ bảng của kho kiện (FE-3b-03): thanh tìm và ba bộ lọc (loại hàng, cờ, đã / chưa vào đơn hay chuyến) là đầu thẻ, dải thao tác
 * trên kiện đang chọn, bảng phân trang; bấm dòng (hoặc nút mã kiện) mở panel chi tiết ở cột phải, Esc đóng và trả con trỏ về mã kiện.
 * Chọn kiện để in nhãn chỉ có với người in được nhãn (`packages.manage`).
 */
export function PackagesTable({ all, rows, list, tabbed, selected, onSelectedChange, openId, onOpenChange }: {
  /** Mọi kiện của kho kiện (thứ tự in nhãn, kiện đang mở). */
  all: readonly PackageRow[]
  /** Kiện sau tìm, lọc và tab. */
  rows: readonly PackageRow[]
  list: ListUrlState<PackageFilterName>
  /** Đang đứng ở một tab trạng thái: bảng rỗng là "không có kết quả khớp". */
  tabbed: boolean
  selected: ReadonlySet<string>
  onSelectedChange: Dispatch<SetStateAction<ReadonlySet<string>>>
  openId: string | null
  onOpenChange: (id: string | null) => void
}) {
  const t = useT()
  const can = useCan()
  const canManage = can('packages.manage')
  const panelId = useId()
  const open = openId !== null && all.some((row) => row.id === openId) ? openId : null

  // Đóng panel thì con trỏ về nút mã kiện của dòng đó — sau khi bảng đã vẽ lại đủ cột
  const focusAfterClose = useRef<string | null>(null)
  useEffect(() => {
    if (open !== null || focusAfterClose.current === null) return
    document.getElementById(packageOpenButtonId(focusAfterClose.current))?.focus()
    focusAfterClose.current = null
  }, [open])
  const close = useCallback((id: string) => {
    focusAfterClose.current = id
    onOpenChange(null)
  }, [onOpenChange])
  const toggleOpen = useCallback((id: string) => (id === open ? close(id) : onOpenChange(id)), [open, close, onOpenChange])

  const panelOpen = open !== null
  const columns = useMemo(() => packageColumns(t, { selectable: canManage, panelOpen }), [t, canManage, panelOpen])
  const selectedIds = useMemo(() => orderedSelection(all, selected), [all, selected])
  const state = useMemo<PackageTableState>(() => {
    const change = (ids: readonly string[], checked: boolean) => onSelectedChange((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
    return {
      selected,
      visibleIds: rows.map((row) => row.id),
      toggle: (id, checked) => change([id], checked),
      setMany: change,
      openId: open,
      onOpen: toggleOpen,
      panelId,
      canOpenOrders: can('orders.view'),
      canOpenTrips: can('trips.view'),
    }
  }, [selected, rows, onSelectedChange, open, toggleOpen, panelId, can])

  // Panel mở thì thẻ bảng hẹp lại: ba bộ lọc xuống hàng thứ hai, dưới ô tìm
  const fields: FilterField<PackageFilterName>[] = [
    {
      kind: 'select', name: CLASS_FILTER, secondary: panelOpen, label: t('sourcing.packages.filters.handlingClass'), allLabel: t('sourcing.packages.filters.allClasses'),
      options: HANDLING_CLASSES.map((value) => ({ value: HANDLING_CLASS_SLUGS[value], label: t(`common.handlingClasses.${value}`) })),
    },
    {
      kind: 'select', name: FLAG_FILTER, secondary: panelOpen, label: t('sourcing.packages.filters.flag'), allLabel: t('sourcing.packages.filters.allFlags'),
      options: FLAG_CHOICES.map((value) => ({ value: FLAG_SLUGS[value], label: value === NO_FLAG ? t('sourcing.packages.filters.noFlag') : t(`common.packageFlags.${value}`) })),
    },
    {
      kind: 'select', name: LINK_FILTER, secondary: panelOpen, label: t('sourcing.packages.filters.link'), allLabel: t('sourcing.packages.filters.allLinks'),
      options: LINK_CHOICES.map((value) => ({ value: LINK_SLUGS[value], label: t(`sourcing.packages.filters.${value}`) })),
    },
  ]

  /** Esc đóng panel, trừ khi một lớp nổi (ô chọn) đã dùng phím đó để tự đóng, hoặc con trỏ đang ở ô nhập. */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented || open === null) return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    close(open)
  }

  return (
    // items-start để panel dính (sticky) trong vùng cuộn. Panel 340 px: ở 1.366 px bảng còn ~960 px sau khi bỏ bốn cột đã có trong panel.
    <div onKeyDown={handleKeyDown} className={cn('grid flex-none items-start gap-5', panelOpen && 'xl:grid-cols-[minmax(0,1fr)_340px]')}>
      <section className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-bg shadow-card">
        <FilterBar
          layout="toolbar"
          className="min-h-14 border-b border-border px-4 py-2"
          query={list.query}
          onQueryChange={list.setQuery}
          searchLabel={t('sourcing.packages.search')}
          fields={fields}
          values={list.filters}
          onValueChange={list.setFilter}
          onClear={list.clearAll}
        />
        {canManage && selectedIds.length > 0 ? <PackageSelectionBar selected={selectedIds} onClear={() => onSelectedChange(new Set())} /> : null}
        <div className="relative overflow-x-auto">
          <div className={panelOpen ? 'min-w-180' : 'min-w-300'}>
            <PackageTableContext value={state}>
              <DataTable
                data={[...rows]}
                columns={columns}
                getRowId={(row) => row.id}
                density="roomy"
                appearance="paper"
                sorting={list.sorting}
                onSortingChange={list.setSorting}
                pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                isFiltering={list.isFiltering || tabbed}
                onClearFilters={list.clearAll}
                isRowSelected={(row) => row.id === open}
                onRowClick={(row) => toggleOpen(row.id)}
              />
            </PackageTableContext>
          </div>
        </div>
      </section>
      {open !== null ? <PackageDetailPanel id={panelId} packageId={open} onClose={() => close(open)} /> : null}
    </div>
  )
}
