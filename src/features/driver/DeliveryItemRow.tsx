import { CircleCheck, Package, TriangleAlert, Undo2 } from 'lucide-react'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { PackageVerification } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { DeliveryItem } from './driver-plan'

/** Dòng "Đã dỡ" kèm cách đối chiếu (FE-6-03): quét QR, gõ mã, xác nhận tay chờ duyệt / đã duyệt. */
function doneLabel(verification: PackageVerification | undefined, t: TFunction): string {
  if (!verification) return t('driver.item.done')
  if (verification.method !== 'MANUAL') return t(`driver.scan.via.${verification.method}`)
  return verification.manual?.status === 'MANUAL_APPROVED' ? t('driver.scan.via.MANUAL_APPROVED') : t('driver.scan.via.MANUAL_PENDING')
}

/**
 * Một dòng kiện hàng cần dỡ, cao tối thiểu 80px. Thứ tự dỡ là `unloadingOrder` của phương án đã duyệt. Dòng chỉ **hiện** trạng thái —
 * kiện được ghi "đã dỡ" qua hộp đối chiếu của điểm giao (D-83), không có nút đánh dấu tay (FE-6-06). Trạng thái không chỉ nằm ở màu
 * (U-7): kiện đã dỡ có nền xanh nhạt và dòng "Đã dỡ" kèm dấu kiểm và cách đối chiếu; kiện có sự cố có nền vàng nhạt và dòng nêu loại sự
 * cố; kiện khách từ chối thêm dòng "Hoàn trả — ở lại xe" (D-84). Kiện có xác nhận tay bị điều phối viên từ chối (FE-6-04) quay về chưa
 * dỡ kèm lý do, để tài xế kiểm lại.
 */
export function DeliveryItemRow({
  item,
  done,
  issueLabel,
  returned = false,
  verification,
}: {
  item: DeliveryItem
  done: boolean
  /** Lần đối chiếu mới nhất của kiện khi dỡ (`ItemProgress.verification`). */
  verification?: PackageVerification
  /** Loại sự cố đã báo cho kiện, đã dịch. */
  issueLabel?: string
  /** Khách từ chối nhận: kiện ở lại xe, thành Hoàn trả khi hoàn tất điểm. */
  returned?: boolean
}) {
  const t = useT()
  const format = useFormat()
  const where = t('driver.item.where', { area: t(`driver.item.area.${item.area}`), layer: t(`driver.item.layer.${item.layer}`) })
  const rejected = !done && verification?.manual?.status === 'MANUAL_REJECTED' ? verification.manual : undefined

  return (
    <li
      data-package-id={item.id}
      data-state={done ? 'unloaded' : returned ? 'returned' : issueLabel ? 'issue' : 'pending'}
      className={cn(
        'flex min-h-20 items-center gap-3 border-b border-border py-3 pr-3 pl-4 last:border-b-0',
        done ? 'bg-badge-success-bg' : issueLabel ? 'bg-badge-warning-bg' : 'bg-bg',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="font-mono text-body-lg leading-5.5 font-semibold text-text">{item.id}</span>
          <span className="font-mono text-body-lg leading-5.5 text-text-3">{t('driver.item.order', { order: item.unloadingOrder })}</span>
        </div>
        <span className="text-body-lg leading-5.5 text-pretty text-text-2">
          {item.name} · <span className="font-mono">{format.weight(item.weightKg)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-body-lg leading-5.5 text-text-3">
          <Package className="size-4 flex-none" strokeWidth={2} aria-hidden />
          {where}
        </span>
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-body-lg leading-5.5 font-medium text-badge-success-fg">
            <CircleCheck className="size-4 flex-none" strokeWidth={2} aria-hidden />
            {doneLabel(verification, t)}
          </span>
        ) : null}
        {rejected ? (
          <span role="alert" className="inline-flex items-start gap-1.5 text-body-lg leading-5.5 font-medium text-danger">
            <TriangleAlert className="mt-0.5 size-4 flex-none" strokeWidth={2} aria-hidden />
            {t('driver.confirms.rejected', { reason: rejected.rejectReason ?? '' })}
          </span>
        ) : null}
        {issueLabel ? (
          <span className="inline-flex items-center gap-1.5 text-body-lg leading-5.5 font-medium text-badge-warning-fg">
            <TriangleAlert className="size-4 flex-none" strokeWidth={2} aria-hidden />
            {t('driver.item.issue', { kind: issueLabel })}
          </span>
        ) : null}
        {returned ? (
          <span className="inline-flex items-center gap-1.5 text-body-lg leading-5.5 font-medium text-badge-warning-fg">
            <Undo2 className="size-4 flex-none" strokeWidth={2} aria-hidden />
            {t('driver.item.returned')}
          </span>
        ) : null}
      </div>
    </li>
  )
}
