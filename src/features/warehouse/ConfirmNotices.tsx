import { Hourglass, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { useT } from '@/lib/i18n'
import { pendingManualConfirms, rejectedConfirms, type Trip } from '@/lib/mock-db'

/**
 * Dải thông báo về xác nhận tay của phiên ở kho, cả bước soạn lẫn bước xếp (FE-6-04, D-83): kiện bị điều phối viên từ chối — kho đã gỡ
 * kết quả của nó nên chuyến quay về đúng kiện đó, kèm lý do để kiểm lại — và số xác nhận tay còn chờ duyệt (chưa xong xếp được khi còn
 * chờ). Chữ 16 px như phần còn lại của màn tablet (mục 10).
 */
export function ConfirmNotices({ trip }: { trip: Trip }) {
  const t = useT()
  const recorded = useMemo(() => new Set(trip.loading?.steps.map((step) => step.packageInstanceId)), [trip.loading])
  const staged = useMemo(() => new Set(trip.loading?.stagedIds), [trip.loading])
  const rejected = [...rejectedConfirms(trip, 'STAGING', staged), ...rejectedConfirms(trip, 'LOADING', recorded)]
  const pending = pendingManualConfirms(trip, 'STAGING').length + pendingManualConfirms(trip, 'LOADING').length
  if (rejected.length === 0 && pending === 0) return null
  return (
    <div className="flex flex-none flex-col gap-2 px-3 pt-3">
      {rejected.map((entry) => (
        <p
          key={entry.id}
          role="alert"
          className="m-0 flex items-start gap-3 rounded-md border border-badge-danger-border bg-badge-danger-bg px-4 py-3 font-medium text-badge-danger-fg"
        >
          <TriangleAlert className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span>{t('warehouse.confirms.rejected', { id: entry.packageInstanceId })}</span>
            <span className="font-normal">{t('warehouse.confirms.rejectReason', { reason: entry.manual?.rejectReason ?? '' })}</span>
          </span>
        </p>
      ))}
      {pending > 0 ? (
        <p role="status" className="m-0 flex items-start gap-3 rounded-md border border-badge-warning-border bg-badge-warning-bg px-4 py-3 font-medium text-badge-warning-fg">
          <Hourglass className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
          {t('warehouse.confirms.pending', { count: pending })}
        </p>
      ) : null}
    </div>
  )
}
