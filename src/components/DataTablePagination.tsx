import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useFormat, useT } from '@/lib/i18n'

/** Cỡ trang chọn được ở chân bảng (D-52). `useListUrlState` chỉ nhận các cỡ này từ URL. */
export const PAGE_SIZES = [25, 50, 100] as const

export const DEFAULT_PAGE_SIZE: number = PAGE_SIZES[0]

/** Phân trang có kiểm soát: màn giữ trang và cỡ trang (thường trên URL qua `useListUrlState`). */
export type DataTablePagination = {
  /** Trang đang xem, đếm từ 0. Vượt số trang (dữ liệu vừa ít đi) thì bảng hiện trang cuối, không tự sửa URL. */
  pageIndex: number
  pageSize: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}

/** Số trang của `rowCount` dòng; bảng rỗng vẫn là một trang. */
export function pageCountOf(rowCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(rowCount / pageSize))
}

/** Trang hiện được: kẹp `pageIndex` vào [0, số trang − 1]. */
export function clampPageIndex(pageIndex: number, rowCount: number, pageSize: number): number {
  return Math.min(Math.max(0, pageIndex), pageCountOf(rowCount, pageSize) - 1)
}

/**
 * Chân bảng: cỡ trang 25/50/100, "x–y / n", nút trước/sau 36px. Nút ở đầu/cuối dùng `aria-disabled` thay vì `disabled`
 * để tiêu điểm bàn phím không rơi mất khi vừa bấm tới trang cuối. `pageIndex` nhận vào đã kẹp trong số trang.
 */
export function PaginationFooter({
  pageIndex,
  pageSize,
  rowCount,
  onPageChange,
  onPageSizeChange,
}: DataTablePagination & { rowCount: number }) {
  const t = useT()
  const format = useFormat()
  const sizeId = useId()
  const pageCount = pageCountOf(rowCount, pageSize)
  const from = rowCount === 0
    ? 0
    : pageIndex * pageSize + 1

  const to = Math.min(
    rowCount,
    (pageIndex + 1) * pageSize,
  )

  return (
    <div className="flex h-12 items-center justify-between gap-4 px-3">
      <div className="flex items-center gap-2">
        <label htmlFor={sizeId} className="text-caption text-text-2">{t('common.table.rowsPerPage')}</label>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger id={sizeId} className="h-9 w-20 font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)} className="font-mono">{format.integer(size)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span aria-live="polite" className="font-mono text-caption text-text-2">
          {t('common.table.range', { from: format.integer(from), to: format.integer(to), total: format.integer(rowCount) })}
        </span>
        <PageButton label={t('common.table.previousPage')} enabled={pageIndex > 0} onClick={() => onPageChange(pageIndex - 1)}>
          <ChevronLeft strokeWidth={1.5} />
        </PageButton>
        <PageButton label={t('common.table.nextPage')} enabled={pageIndex < pageCount - 1} onClick={() => onPageChange(pageIndex + 1)}>
          <ChevronRight strokeWidth={1.5} />
        </PageButton>
      </div>
    </div>
  )
}

function PageButton({ label, enabled, onClick, children }: {
  label: string
  enabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="secondary"
      size="icon"
      aria-label={label}
      aria-disabled={enabled ? undefined : true}
      onClick={enabled ? onClick : undefined}
      className="aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-border aria-disabled:text-text-disabled aria-disabled:hover:bg-border"
    >
      {children}
    </Button>
  )
}
