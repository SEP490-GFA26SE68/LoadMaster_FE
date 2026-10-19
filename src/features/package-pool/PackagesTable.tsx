import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
} from 'react'

import { DataTable } from '@/components/DataTable'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import type { ListUrlState } from '@/components/useListUrlState'
import { HANDLING_CLASSES } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { createColumnHelper } from '@tanstack/react-table'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import {
  packageColumns,
  packageOpenButtonId,
  PackageTableContext,
  type PackageTableState,
} from './package-columns'

import { PackageDetailPanel } from './PackageDetailPanel'

import {
  CLASS_FILTER,
  HANDLING_CLASS_SLUGS,
  STATUS_FILTER,
  type CargoPackageRow,
} from './packages-list'

type CargoFilterName =
  | typeof STATUS_FILTER
  | typeof CLASS_FILTER

type Props = {
  rows: readonly CargoPackageRow[]
  list: ListUrlState<CargoFilterName>
  totalElements: number
  tabbed: boolean
  openId: string | null
  onOpenChange: (id: string | null) => void

  selectedIds: ReadonlySet<string>
  onSelectionChange: (ids: Set<string>) => void
}

/**
 * Bảng CargoPackage từ BE.
 * Hỗ trợ phân trang server-side và panel chi tiết kiện.
 *
 * Tìm kiếm, lọc loại hàng và sorting hiện vẫn hoạt động
 * trên trang đã tải, chờ BE hỗ trợ lọc toàn bộ kho.
 */
const helper = createColumnHelper<
  BaseTableFeatures,
  CargoPackageRow
>()
export function PackagesTable({
  rows,
  list,
  totalElements,
  tabbed,
  openId,
  onOpenChange,
  selectedIds,
  onSelectionChange,
}: Props) {
  const t = useT()
  const panelId = useId()

  const open =
    openId !== null &&
      rows.some((row) => row.id === openId)
      ? openId
      : null

  const focusAfterClose = useRef<string | null>(null)

  useEffect(() => {
    if (open !== null || focusAfterClose.current === null) {
      return
    }

    document
      .getElementById(
        packageOpenButtonId(focusAfterClose.current),
      )
      ?.focus()

    focusAfterClose.current = null
  }, [open])

  const close = useCallback(
    (id: string) => {
      focusAfterClose.current = id
      onOpenChange(null)
    },
    [onOpenChange],
  )

  const toggleOpen = useCallback(
    (id: string) => {
      if (id === open) {
        close(id)
      } else {
        onOpenChange(id)
      }
    },
    [open, close, onOpenChange],
  )

  const panelOpen = open !== null
  const pageIds = rows.map((row) => row.id)

  const allPageSelected =
    pageIds.length > 0 &&
    pageIds.every((id) => selectedIds.has(id))

  const somePageSelected =
    pageIds.some((id) => selectedIds.has(id))

  const togglePackageSelection = useCallback(
    (id: string, checked: boolean) => {
      const next = new Set(selectedIds)

      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }

      onSelectionChange(next)
    },
    [selectedIds, onSelectionChange],
  )

  const toggleSelectPage = useCallback(
    (checked: boolean) => {
      const next = new Set(selectedIds)

      for (const row of rows) {
        if (checked) {
          next.add(row.id)
        } else {
          next.delete(row.id)
        }
      }

      onSelectionChange(next)
    },
    [rows, selectedIds, onSelectionChange],
  )



  const columns = useMemo(() => {
    const selectionColumn = helper.display({
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          aria-label="Chọn tất cả kiện trên trang"
          checked={allPageSelected}
          ref={(element) => {
            if (element) {
              element.indeterminate =
                somePageSelected && !allPageSelected
            }
          }}
          onChange={(event) =>
            toggleSelectPage(event.target.checked)
          }
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        />
      ),
      cell: (info) => {
        const pkg = info.row.original

        return (
          <input
            type="checkbox"
            aria-label={`Chọn kiện ${pkg.packageCode}`}
            checked={selectedIds.has(pkg.id)}
            onChange={(event) =>
              togglePackageSelection(
                pkg.id,
                event.target.checked,
              )
            }
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          />
        )
      },
      enableSorting: false,
      meta: {
        width: '48px',
      } satisfies ColumnMeta,
    })

    return helper.columns([
      selectionColumn,
      ...packageColumns(t, { panelOpen }),
    ])
  }, [
    t,
    panelOpen,
    selectedIds,
    allPageSelected,
    somePageSelected,
    togglePackageSelection,
    toggleSelectPage,
  ])



  const state = useMemo<PackageTableState>(
    () => ({
      openId: open,
      onOpen: toggleOpen,
      panelId,
    }),
    [open, toggleOpen, panelId],
  )

  const fields: FilterField<CargoFilterName>[] = [
    {
      kind: 'select',
      name: CLASS_FILTER,
      secondary: panelOpen,
      label: t('sourcing.packages.filters.handlingClass'),
      allLabel: t('sourcing.packages.filters.allClasses'),
      options: HANDLING_CLASSES.map((value) => ({
        value: HANDLING_CLASS_SLUGS[value],
        label: t(`common.handlingClasses.${value}`),
      })),
    },
  ]

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      open === null
    ) {
      return
    }

    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return
    }

    close(open)
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      className={cn(
        'grid flex-none items-start gap-5',
        panelOpen && 'xl:grid-cols-[minmax(0,1fr)_340px]',
      )}
    >
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

        <div className="relative overflow-x-auto">
          <div className={panelOpen ? 'min-w-180' : 'min-w-240'}>
            <PackageTableContext value={state}>
              <DataTable
                data={[...rows]}
                columns={columns}
                getRowId={(row) => row.id}
                density="roomy"
                appearance="paper"
                serverPagination
                totalRows={totalElements}
                sorting={list.sorting}
                onSortingChange={list.setSorting}
                pagination={{
                  pageIndex: list.pageIndex,
                  pageSize: list.pageSize,
                  onPageChange: list.setPage,
                  onPageSizeChange: list.setPageSize,
                }}
                isFiltering={list.isFiltering || tabbed}
                onClearFilters={list.clearAll}
                isRowSelected={(row) => row.id === open}
                onRowClick={(row) => toggleOpen(row.id)}
              />
            </PackageTableContext>
          </div>
        </div>
      </section>

      {open !== null ? (
        <PackageDetailPanel
          id={panelId}
          packageId={open}
          onClose={() => close(open)}
        />
      ) : null}
    </div>
  )
}