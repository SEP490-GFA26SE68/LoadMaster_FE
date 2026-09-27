import { functionalUpdate, useTable, type Row, type SortingState, type Updater } from '@tanstack/react-table'
import { useMemo } from 'react'
import { baseTableFeatures, type BaseTableFeatures, type DataTableColumns, type DataTablePagination } from '@/components/DataTable'
import { clampPageIndex, PaginationFooter } from '@/components/DataTablePagination'
import { NoMatchRow, SortHeader } from '@/components/DataTableParts'
import { ALIGN, APPEARANCE, ROW_HEIGHT } from '@/components/data-table-styles'
import { cn } from '@/lib/utils'
import type { TripRow } from './trip-list'
import type { TripColumnMeta } from './trip-list-columns'
import { TripDateGroupHeader } from './TripListDateGroup'

const LOOK = APPEARANCE.paper
const NO_SORTING = { enableSorting: false }

/** Dòng liền nhau cùng ngày chạy của trang đang xem; `date` rỗng khi bảng không nhóm (sắp theo cột khác). */
type Section = { date: string; rows: Row<BaseTableFeatures, TripRow>[] }

function sectionsOf(rows: Row<BaseTableFeatures, TripRow>[], grouped: boolean): Section[] {
  if (!grouped) return [{ date: '', rows }]
  const sections: Section[] = []
  for (const row of rows) {
    const last = sections.at(-1)
    if (last?.date === row.original.scheduledDate) last.rows.push(row)
    else sections.push({ date: row.original.scheduledDate, rows: [row] })
  }
  return sections
}

/**
 * Bảng danh sách chuyến V2.3 (`ChuyenHang.jpg`): kiểu `DataTable appearance="paper"`, thêm **dòng nhóm theo ngày chạy** khi bảng sắp
 * theo ngày chạy (mặc định). `DataTable` dùng chung chưa có dòng nhóm, nên bảng này dựng thẳng trên TanStack Table v9 với cùng tính
 * năng (`baseTableFeatures`), cùng tiêu đề sắp xếp, hàng "không khớp" và chân phân trang. Mỗi nhóm là một `<tbody>` có `<th
 * scope="rowgroup">` để trình đọc màn hình đọc được ngày của từng dòng. Phân trang đếm dòng chuyến, không đếm dòng nhóm; số chuyến
 * của nhóm đếm trên cả danh sách đã lọc.
 */
export function TripListTable({
  data,
  columns,
  sorting,
  onSortingChange,
  pagination,
  countsByDate,
  today,
  onClearFilters,
  onRowClick,
}: {
  data: TripRow[]
  columns: DataTableColumns<TripRow>
  sorting: SortingState
  onSortingChange: (sorting: SortingState) => void
  pagination: DataTablePagination
  countsByDate: ReadonlyMap<string, number>
  /** Hôm nay `YYYY-MM-DD` (giờ Việt Nam) để gắn nhãn "Hôm nay" / "Ngày mai". */
  today: string
  /** Danh sách trống thì màn hiện trạng thái rỗng riêng: bảng rỗng ở đây luôn là "không có kết quả khớp bộ lọc". */
  onClearFilters: () => void
  onRowClick: (row: TripRow) => void
}) {
  const rowCount = data.length
  const pageIndex = clampPageIndex(pagination.pageIndex, rowCount, pagination.pageSize)
  const { pageSize } = pagination
  const page = useMemo(() => ({ pageIndex, pageSize }), [pageIndex, pageSize])

  const table = useTable({
    features: baseTableFeatures,
    columns,
    data,
    defaultColumn: NO_SORTING,
    enableMultiSort: false,
    enableSortingRemoval: false,
    // Trang do màn giữ trên URL: dữ liệu về muộn không được kéo người dùng về trang 1.
    autoResetPageIndex: false,
    state: { sorting, pagination: page },
    onSortingChange: (updater: Updater<SortingState>) => onSortingChange(functionalUpdate(updater, sorting)),
    getRowId: (row) => row.id,
  })

  const visible = table.getAllLeafColumns().filter((column) => !(column.columnDef.meta as TripColumnMeta | undefined)?.hidden)
  const visibleIds = new Set(visible.map((column) => column.id))
  const grouped = sorting[0]?.id === 'scheduledDate'
  const sections = sectionsOf(table.getRowModel().rows, grouped)
  const rowHeight = ROW_HEIGHT.roomy

  return (
    <>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {table.getHeaderGroups()[0]?.headers.filter((header) => visibleIds.has(header.column.id)).map((header) => {
              const meta = header.column.columnDef.meta as TripColumnMeta | undefined
              const align = meta?.align ?? 'left'
              const sorted = header.column.getCanSort() ? header.column.getIsSorted() : false
              return (
                <th
                  key={header.id}
                  aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                  style={meta?.width ? { width: meta.width } : undefined}
                  className={cn('sticky top-0 z-10 border-b border-border text-caption leading-none', LOOK.head, LOOK.padX, ALIGN[align])}
                >
                  {header.column.getCanSort() ? (
                    <SortHeader direction={sorted} align={align} onToggle={header.column.getToggleSortingHandler()}>
                      <table.FlexRender header={header} />
                    </SortHeader>
                  ) : (
                    <table.FlexRender header={header} />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        {rowCount === 0 ? (
          <tbody>
            <NoMatchRow columnCount={visible.length} onClear={onClearFilters} />
          </tbody>
        ) : sections.map((section) => (
          <tbody key={section.date || 'all'}>
            {section.date ? (
              <TripDateGroupHeader date={section.date} today={today} count={countsByDate.get(section.date) ?? section.rows.length} columnCount={visible.length} />
            ) : null}
            {section.rows.map((row) => (
              <tr key={row.id} onClick={() => onRowClick(row.original)} className={cn(rowHeight, 'cursor-pointer hover:bg-surface')}>
                {row.getAllCells().filter((cell) => visibleIds.has(cell.column.id)).map((cell) => {
                  const meta = cell.column.columnDef.meta as TripColumnMeta | undefined
                  return (
                    <td key={cell.id} className={cn(rowHeight, 'border-b border-line-soft text-body whitespace-nowrap', LOOK.padX, ALIGN[meta?.align ?? 'left'])}>
                      <table.FlexRender cell={cell} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      {rowCount > 0 ? <PaginationFooter {...pagination} pageIndex={pageIndex} rowCount={rowCount} /> : null}
    </>
  )
}
