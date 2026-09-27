import { createColumnHelper } from '@tanstack/react-table'
import { createContext, useContext, useMemo, useState } from 'react'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { clampPageIndex, DEFAULT_PAGE_SIZE, PaginationFooter } from '@/components/DataTablePagination'
import { StatusBadge } from '@/components/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { VehicleName } from '@/components/VehicleName'
import type { TripRow } from '@/features/trips/trip-list'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { SheetCard } from '../SheetLayout'

const helper = createColumnHelper<BaseTableFeatures, TripRow>()

/** Dòng đang chọn đi qua context: hàm ô khai một lần, không dựng lại cột mỗi lần chọn (AGENTS mục 5, TanStack v9). */
const SelectedContext = createContext<string | null>(null)

/** Ô đầu: tên chuyến + mã · số điểm giao; dòng đang chọn có vạch cyan 3px sát mép trái (cao đúng hàng 56px). */
function TripCell({ row, t }: { row: TripRow; t: TFunction }) {
  const selected = useContext(SelectedContext) === row.id
  return (
    <span className="relative flex min-w-0 flex-col">
      {selected ? <span aria-hidden className="absolute top-1/2 -left-3.5 h-14 w-0.75 -translate-y-1/2 bg-cyan-500" /> : null}
      <span className="truncate font-semibold text-ink-strong">{row.name}</span>
      <span className="truncate text-caption text-ink-3">
        {t('designSystem.components.table.trip', { id: row.id, stops: t('trips.list.stops', { count: row.stopCount }) })}
      </span>
    </span>
  )
}

function createColumns(t: TFunction, format: Formatter) {
  return helper.columns([
    helper.accessor('name', {
      header: t('trips.list.name'),
      cell: (info) => <TripCell row={info.row.original} t={t} />,
    }),
    helper.accessor('vehicleName', {
      header: t('trips.list.vehicle'),
      meta: { width: '22%' } satisfies ColumnMeta,
      cell: (info) => <VehicleName name={info.getValue()} className="line-clamp-2 whitespace-normal" />,
    }),
    helper.accessor('packageCount', {
      header: t('trips.list.packages'),
      meta: { align: 'right', width: '88px' } satisfies ColumnMeta,
      cell: (info) => <span className="font-mono text-caption font-semibold">{format.integer(info.getValue())}</span>,
    }),
    helper.accessor('volumePercent', {
      header: t('trips.list.volume'),
      meta: { width: '180px' } satisfies ColumnMeta,
      cell: (info) => {
        const value = info.getValue()
        if (value === null) return <span className="text-caption text-ink-3">{t('trips.list.notOptimized')}</span>
        return (
          <span className="flex items-center gap-2">
            <ProgressBar value={value} className="w-12" />
            <span className="font-mono text-caption">{format.percent(value)}</span>
          </span>
        )
      },
    }),
    helper.accessor('status', {
      header: t('trips.list.status'),
      meta: { width: '180px' } satisfies ColumnMeta,
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
  ])
}

/**
 * Bảng dữ liệu V2.3 trên mọi chuyến của kho (cùng hook với màn Chuyến hàng): tiêu đề cột dính, số canh phải, phân trang 25/50/100.
 * Bấm một dòng để chọn; mặc định chọn dòng đầu.
 *
 * Bản mẫu cắt bảng còn ba dòng: ở đây trang của bảng nằm trong khung cuộn cao chừng bốn dòng — thấy luôn tiêu đề cột dính — còn chân
 * phân trang đứng ngoài khung. Vì vậy trang tự cắt dòng và dựng `PaginationFooter`, không truyền `pagination` cho `DataTable` (chân
 * của nó sẽ nằm trong khung cuộn).
 */
export function TripTableCard({ rows }: { rows: readonly TripRow[] | undefined }) {
  const t = useT()
  const format = useFormat()
  const columns = useMemo(() => createColumns(t, format), [t, format])
  const [picked, setPicked] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const rowCount = rows?.length ?? 0
  const pageIndex = clampPageIndex(page, rowCount, pageSize)
  const data = useMemo(() => (rows ?? []).slice(pageIndex * pageSize, (pageIndex + 1) * pageSize), [rows, pageIndex, pageSize])
  const selected = picked ?? rows?.[0]?.id ?? null

  return (
    <SheetCard title={t('designSystem.components.table.title')} meta={t('designSystem.components.table.meta')} bare>
      {rows ? (
        <>
          {/* Cuộn ngang ở màn hẹp; relative vì ô ẩn định vị tuyệt đối của Radix không được thoát khung (AGENTS mục 5) */}
          <div tabIndex={0} role="region" aria-label={t('designSystem.components.table.title')} className="relative max-h-73 overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
            <div className="min-w-180">
              <SelectedContext value={selected}>
                <DataTable
                  data={data}
                  columns={columns}
                  density="roomy"
                  appearance="paper"
                  getRowId={(row) => row.id}
                  isRowSelected={(row) => row.id === selected}
                  onRowClick={(row) => setPicked(row.id)}
                />
              </SelectedContext>
            </div>
          </div>
          <div className="relative border-t border-line-soft">
            <PaginationFooter
              pageIndex={pageIndex}
              pageSize={pageSize}
              rowCount={rowCount}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0) }}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 p-4.5">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-8 w-full" />)}
        </div>
      )}
    </SheetCard>
  )
}
