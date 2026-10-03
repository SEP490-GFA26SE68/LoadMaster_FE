import { Check, Clock, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DialogClose, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { SceneStop } from '../scene-input'

/**
 * Điểm giao kèm giờ đến dự kiến và hạn (FE-5b-08, D-80) — số của tuyến đã tối ưu của chuyến (mock tối ưu tuyến, nên mang MOCK RESULT).
 * Dùng ở hộp thoại Duyệt: điểm sát hạn, điểm trễ hạn dự kiến, và bước xác nhận duyệt dù trễ hạn.
 */
export function DeadlineStopList({ stops, label, className }: { stops: readonly SceneStop[]; label?: string; className?: string }) {
  const t = useT()
  const format = useFormat()
  return (
    <ul aria-label={label} className={cn('m-0 flex list-none flex-col gap-1.5 p-0 text-small', className)}>
      {stops.map((stop) => (
        <li key={stop.number} data-deadline-stop={stop.number} className="flex flex-col gap-0.5">
          <span className="font-semibold text-ink-strong">{t('viewer.deadlines.stop', { number: stop.number, name: stop.name })}</span>
          {stop.eta && stop.deadline ? (
            <span className="text-ink-2 tabular-nums">
              {t('viewer.plan.dialog.stopTimes', {
                etaTime: format.time(stop.eta), etaDate: format.dayMonth(stop.eta),
                deadlineTime: format.time(stop.deadline), deadlineDate: format.dayMonth(stop.deadline),
              })}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * Bước xác nhận của hộp thoại Duyệt khi tuyến có điểm trễ hạn dự kiến (D-80): liệt kê từng điểm với giờ đến dự kiến và hạn; "Vẫn duyệt"
 * mới gửi Duyệt kèm `force`, "Quay lại" về bước xem xét. Điểm sát hạn không tới bước này.
 */
export function LateStopsConfirm({ stops, pending, onBack, onConfirm }: {
  stops: readonly SceneStop[]
  pending: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  const t = useT()
  return (
    <>
      <DialogHeader icon={Clock} tone="warning" title={t('viewer.plan.dialog.late.title')} description={t('viewer.plan.dialog.late.description')}>
        <DialogClose asChild>
          <Button variant="ghost" size="icon" aria-label={t('viewer.plan.dialog.close')} className="-mt-1 -mr-2 text-n-600">
            <X strokeWidth={1.5} aria-hidden />
          </Button>
        </DialogClose>
      </DialogHeader>
      <div className="flex flex-col gap-2.5 px-7 pt-4 pb-4.5">
        <DeadlineStopList stops={stops} label={t('viewer.plan.dialog.late.list')}
          className="max-h-[40dvh] overflow-y-auto rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5" />
      </div>
      <DialogFooter className="px-5.5">
        <span className="mr-auto"><Badge shape="tag" tone="mock">MOCK RESULT</Badge></span>
        <Button variant="secondary" onClick={onBack}>{t('viewer.plan.dialog.late.back')}</Button>
        <Button variant="primary" disabled={pending} loading={pending} onClick={onConfirm}>
          <Check strokeWidth={1.5} />{t('viewer.plan.dialog.late.confirm')}
        </Button>
      </DialogFooter>
    </>
  )
}
