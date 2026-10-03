import { Check, CircleCheck, Package, TriangleAlert } from 'lucide-react'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { PackageVerification } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { DeliveryItem } from './driver-plan'

/** Dòng "Đã dỡ" kèm cách đối chiếu (FE-6-03): quét QR, gõ mã, xác nhận tay chờ duyệt / đã duyệt; đánh dấu tay thì chỉ "Đã dỡ". */
function doneLabel(verification: PackageVerification | undefined, t: TFunction): string {
  if (!verification) return t('driver.item.done')
  if (verification.method !== 'MANUAL') return t(`driver.scan.via.${verification.method}`)
  return verification.manual?.status === 'MANUAL_APPROVED' ? t('driver.scan.via.MANUAL_APPROVED') : t('driver.scan.via.MANUAL_PENDING')
}

/**
 * Một dòng kiện hàng cần dỡ, cao tối thiểu 80px, nút tròn 56px bên phải để bấm được khi đeo găng. Thứ tự dỡ là `unloadingOrder`
 * của phương án đã duyệt. Trạng thái không chỉ nằm ở viền (U-7): kiện đã dỡ có nền xanh nhạt và dòng "Đã dỡ" kèm dấu kiểm và cách đối
 * chiếu, kiện có sự cố có nền vàng nhạt và dòng nêu loại sự cố. Kiện có xác nhận tay bị điều phối viên từ chối (FE-6-04) quay về chưa
 * dỡ kèm lý do, để tài xế kiểm lại.
 */
export function DeliveryItemRow({
  item,
  done,
  onToggle,
  issueLabel,
  readOnly = false,
  verification,
}: {
  item: DeliveryItem
  done: boolean
  /** Lần đối chiếu mới nhất của kiện khi dỡ (`ItemProgress.verification`). */
  verification?: PackageVerification
  onToggle: (id: string) => void
  /** Loại sự cố đã báo cho kiện, đã dịch. */
  issueLabel?: string
  /** Chưa bắt đầu giao: chỉ xem, không có nút đánh dấu. */
  readOnly?: boolean
}) {
  const t = useT()
  const format = useFormat()
  const where = t('driver.item.where', { area: t(`driver.item.area.${item.area}`), layer: t(`driver.item.layer.${item.layer}`) })
  const rejected = !done && verification?.manual?.status === 'MANUAL_REJECTED' ? verification.manual : undefined

  return (
    <li
      data-package-id={item.id}
      data-state={done ? 'unloaded' : issueLabel ? 'issue' : 'pending'}
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
        <span className="truncate text-body-lg leading-5.5 text-text-2">
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
      </div>

      {readOnly ? null : (
        <button
          type="button"
          aria-label={t(done ? 'driver.item.unmarkDone' : 'driver.item.markDone', { id: item.id })}
          aria-pressed={done}
          onClick={() => onToggle(item.id)}
          className={cn(
            'grid size-14 flex-none place-items-center rounded-full',
            'transition-colors duration-(--dur-fast) ease-standard',
            'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            done ? 'bg-success text-white' : 'border-2 border-success bg-bg text-badge-success-fg',
          )}
        >
          {done ? <Check className="size-7" strokeWidth={3} aria-hidden /> : <span className="text-body-lg leading-none font-semibold">{t('driver.item.done')}</span>}
        </button>
      )}
    </li>
  )
}
