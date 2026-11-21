import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

import { clampPageIndex, pageCountOf } from '@/components/DataTablePagination'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Số phiên bản mức lương mỗi trang trong hộp thoại — vừa khung giữa màn, không kéo dài trang Bảng lương. */
export const PAYROLL_VERSION_PAGE_SIZE = 5

/** Số dòng nhân viên mỗi trang trên bảng lương — tránh kéo dài trang. */
export const PAYROLL_TABLE_PAGE_SIZE = 5

export function pagedPayrollItems<T>(items: readonly T[], pageIndex: number, pageSize: number): {
  pageIndex: number
  pageCount: number
  items: readonly T[]
} {
  const pageCount = pageCountOf(items.length, pageSize)
  const page = clampPageIndex(pageIndex, items.length, pageSize)
  return { pageIndex: page, pageCount, items: items.slice(page * pageSize, (page + 1) * pageSize) }
}

export function usePagedPayrollItems<T>(items: readonly T[], pageSize: number) {
  const [pageIndex, setPageIndex] = useState(0)
  const page = pagedPayrollItems(items, pageIndex, pageSize)
  useEffect(() => {
    setPageIndex((current) => pagedPayrollItems(items, current, pageSize).pageIndex)
  }, [items, pageSize])
  return { ...page, setPageIndex, pageSize, total: items.length }
}

export function PayrollDialogPager({
  pageIndex,
  pageCount,
  pageSize,
  total,
  label,
  onPageChange,
  className,
}: {
  pageIndex: number
  pageCount: number
  pageSize: number
  total: number
  label: string
  onPageChange: (pageIndex: number) => void
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  if (total <= pageSize) return null
  const from = pageIndex * pageSize + 1
  const to = Math.min(total, (pageIndex + 1) * pageSize)
  return (
    <nav aria-label={label} className={cn('flex h-12 shrink-0 items-center justify-between gap-2 border-t border-line-soft px-7', className)}>
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
