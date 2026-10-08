import { CircleCheck, Package, TriangleAlert } from 'lucide-react'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PickupItemProgress } from './delivery-progress'

/**
 * Một dòng kiện nhận dọc đường (FE-7-05), cao tối thiểu 80px như `DeliveryItemRow`. Khác kiện của phương án: không có thứ tự dỡ, vùng hay lớp
 * — chỗ xếp của kiện nằm cùng yêu cầu và hiện trong khung 3D (FE-BL-01). Điểm nhận: "Chưa nhận" / "Đã nhận"; điểm giao: "Chưa dỡ" / "Đã dỡ", kèm cách đối chiếu gần nhất. Trạng thái
 * không chỉ nằm ở màu: kiện xong có nền xanh nhạt, dấu kiểm và chữ; xác nhận tay bị điều phối viên từ chối (FE-6-04) thì kiện quay về chưa xong
 * kèm lý do.
 */
export function PickupItemRow({ progress }: { progress: PickupItemProgress }) {
  const t = useT()
  const format = useFormat()
  const { item, done, verification } = progress
  const via = verification === undefined ? undefined
    : verification.method !== 'MANUAL' ? verification.method
      : verification.manual?.status === 'MANUAL_APPROVED' ? 'MANUAL_APPROVED' : 'MANUAL_PENDING'
  const rejected = !done && verification?.manual?.status === 'MANUAL_REJECTED' ? verification.manual : undefined

  return (
    <li
      data-package-id={item.id}
      data-role={item.role}
      data-state={done ? 'done' : 'pending'}
      className={cn('flex min-h-20 items-center gap-3 border-b border-border py-3 pr-3 pl-4 last:border-b-0', done ? 'bg-badge-success-bg' : 'bg-bg')}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-mono text-body-lg leading-5.5 font-semibold text-text">{item.id}</span>
        <span className="text-body-lg leading-5.5 text-pretty text-text-2">
          {item.name} · <span className="font-mono">{format.weight(item.weightKg)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-body-lg leading-5.5 text-text-3">
          <Package className="size-4 flex-none" strokeWidth={2} aria-hidden />
          {t('driver.pickup.request', { id: item.requestId })}
        </span>
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-body-lg leading-5.5 font-medium text-badge-success-fg">
            <CircleCheck className="size-4 flex-none" strokeWidth={2} aria-hidden />
            {t(`driver.pickup.${item.role}.done`)}{via === undefined ? '' : ` · ${t(`driver.pickup.via.${via}`)}`}
          </span>
        ) : (
          <span className="text-body-lg leading-5.5 font-medium text-text-2">{t(`driver.pickup.${item.role}.waiting`)}</span>
        )}
        {rejected ? (
          <span role="alert" className="inline-flex items-start gap-1.5 text-body-lg leading-5.5 font-medium text-danger">
            <TriangleAlert className="mt-0.5 size-4 flex-none" strokeWidth={2} aria-hidden />
            {t('driver.confirms.rejected', { reason: rejected.rejectReason ?? '' })}
          </span>
        ) : null}
      </div>
    </li>
  )
}
