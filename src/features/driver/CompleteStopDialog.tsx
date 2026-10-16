import { ArrowRight, CircleCheck, Flag, PackageCheck, PackageOpen, TriangleAlert, Undo2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/Dialog'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { DeliveryView } from './delivery-progress'
import type { StopDelivery } from './driver-plan'
import { stopCompletion } from './stop-completion'

type CompleteStopDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: DeliveryView
  /** Mọi điểm của chuyến: để nói điểm kế tiếp, hoặc đây là điểm cuối. */
  stops: readonly StopDelivery[]
  pending: boolean
  onConfirm: () => void
}

/**
 * Hỏi lại trước khi hoàn tất điểm giao hoặc điểm nhận: hoàn tất là ghi thật vào kho và không mở lại được. Hộp nói điều sẽ xảy ra với từng
 * nhóm kiện (`stopCompletion`) — đã dỡ thành Đã giao, chưa dỡ ở lại xe thành Hoàn trả (bằng chữ, kèm mã từng kiện), kiện nhận lên xe thành
 * Đang vận chuyển — số sự cố đã báo, và điểm kế tiếp hay đây là điểm cuối. Điện thoại: tờ trượt từ đáy; từ 768 px là hộp giữa màn. Nút
 * 56 px, chữ 16 px. Đang ghi thì không đóng được; lỗi thì hộp giữ nguyên (nơi gọi bật toast lỗi); ghi xong hộp đóng, không có toast
 * thành công — màn sang điểm kế tiếp hoặc tổng kết chuyến.
 */
export function CompleteStopDialog({ open, onOpenChange, view, stops, pending, onConfirm }: CompleteStopDialogProps) {
  const t = useT()
  const { delivered, returned, picked, issues, next } = stopCompletion(view, stops)
  const nothing = delivered + returned.length + picked === 0
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!pending) onOpenChange(value) }}>
      <DialogContent sheet className="w-[min(36rem,calc(100vw-3rem))] text-body-lg">
        <div className="flex flex-col gap-4 px-5 pt-3 pb-5 md:px-6 md:pt-6">
          <div className="flex flex-col gap-1">
            <DialogTitle className="font-display text-h2 leading-6.5 font-bold text-pretty text-ink-strong font-stretch-106%">
              {t('driver.completeConfirm.title', { number: view.stop.number, name: view.stop.name })}
            </DialogTitle>
            <DialogDescription className="text-body-lg text-pretty text-ink-2">{t('driver.completeConfirm.description')}</DialogDescription>
          </div>

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {nothing ? <Line icon={PackageOpen}>{t('driver.noItems')}</Line> : null}
            {delivered > 0 ? <Line icon={CircleCheck} done>{t('driver.completeConfirm.delivered', { count: delivered })}</Line> : null}
            {picked > 0 ? <Line icon={PackageCheck} done>{t('driver.completeConfirm.picked', { count: picked })}</Line> : null}
            {returned.length > 0 ? (
              // Hoàn trả nói bằng chữ và mã kiện; nền hổ phách chỉ để nhấn
              <li className="flex flex-col gap-1.5 rounded-lg border border-badge-warning-border bg-badge-warning-bg px-3 py-2.5 font-medium text-badge-warning-fg">
                <span className="flex items-start gap-2.5">
                  <Undo2 className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
                  <span className="min-w-0 text-pretty">{t('driver.completeConfirm.returned', { count: returned.length })}</span>
                </span>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pl-7.5 text-ink-strong">
                  {returned.map((item) => (
                    <li key={item.id} className="text-pretty">
                      <span className="font-mono">{item.id}</span> · {item.name}
                    </li>
                  ))}
                </ul>
              </li>
            ) : null}
            {issues > 0 ? <Line icon={TriangleAlert}>{t('driver.completeConfirm.issues', { count: issues })}</Line> : null}
          </ul>

          <p className="m-0 flex items-start gap-2.5 text-ink-2">
            {next ? <ArrowRight className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden /> : <Flag className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />}
            <span className="min-w-0 text-pretty">{next ? t('driver.completeConfirm.next', { number: next.number, name: next.name }) : t('driver.completeConfirm.last')}</span>
          </p>
        </div>

        <DialogFooter className="sticky bottom-0 justify-end px-5 md:px-6">
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="touch" className="max-md:flex-1" disabled={pending}>{t('driver.completeConfirm.cancel')}</Button>
          </DialogClose>
          <Button type="button" variant="primary" size="touch" className="max-md:flex-1" loading={pending} onClick={onConfirm}>
            {t('driver.completeConfirm.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Một dòng của hộp hỏi lại; `done` tô icon xanh lá — chữ vẫn nói đủ. */
function Line({ icon: Icon, done = false, children }: { icon: LucideIcon; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 font-medium text-ink-strong">
      <Icon className={cn('mt-0.5 size-5 flex-none', done ? 'text-badge-success-fg' : 'text-ink-3')} strokeWidth={2} aria-hidden />
      <span className="min-w-0 text-pretty">{children}</span>
    </li>
  )
}
