import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { pagedTrips } from './monitoring-view'

/** Trang đã kẹp khi danh sách ngắn lại (lọc, dữ liệu mới). */
export function usePagedItems<T>(items: readonly T[], pageSize: number) {
  const [pageIndex, setPageIndex] = useState(0)
  const page = pagedTrips(items, pageIndex, pageSize)
  useEffect(() => {
    setPageIndex((current) => pagedTrips(items, current, pageSize).pageIndex)
  }, [items, pageSize])
  return { ...page, setPageIndex, pageSize, total: items.length }
}

/** Chân card phân trang gọn: "x–y / n" và nút trước/sau — cùng kiểu khung chuyến cạnh bản đồ. */
export function MonitoringPager({
  pageIndex,
  pageCount,
  pageSize,
  total,
  label,
  onPageChange,
}: {
  pageIndex: number
  pageCount: number
  pageSize: number
  total: number
  label: string
  onPageChange: (pageIndex: number) => void
}) {
  const t = useT()
  const format = useFormat()
  if (total <= pageSize) return null
  const from = pageIndex * pageSize + 1
  const to = Math.min(total, (pageIndex + 1) * pageSize)
  return (
    <nav aria-label={label} className="mt-auto flex h-12 shrink-0 items-center justify-between gap-2 border-t border-line-soft px-3">
      <span aria-live="polite" className="font-mono text-caption text-text-2">
        {t('common.table.range', {
          from: format.integer(from),
          to: format.integer(to),
          total: format.integer(total),
        })}
      </span>
      <div className="flex items-center gap-2">
        <PageButton label={t('common.table.previousPage')} enabled={pageIndex > 0} onClick={() => onPageChange(pageIndex - 1)}>
          <ChevronLeft strokeWidth={1.5} />
        </PageButton>
        <PageButton label={t('common.table.nextPage')} enabled={pageIndex < pageCount - 1} onClick={() => onPageChange(pageIndex + 1)}>
          <ChevronRight strokeWidth={1.5} />
        </PageButton>
      </div>
    </nav>
  )
}

function PageButton({ label, enabled, onClick, children }: {
  label: string
  enabled: boolean
  onClick: () => void
  children: React.ReactNode
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
