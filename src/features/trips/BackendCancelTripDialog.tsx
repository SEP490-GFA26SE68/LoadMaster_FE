import { zodResolver } from '@hookform/resolvers/zod'
import { Ban } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { canCancelTrip } from '@/lib/mock-db'
import { useBackendTripExceptionsQuery, useCancelBackendTripMutation } from './useTripEditBackendQuery'

type CancelValues = { reason: string }

/** Máy chủ giới hạn lý do huỷ ở 500 ký tự (`TripCancelRequest`). */
const MAX_REASON = 500

/**
 * Huỷ chuyến bản máy chủ (`POST /api/trips/{id}/cancel`): lý do bắt buộc kèm bộ đếm, nút nguy hiểm. Chuyến Đang vận chuyển (`inTransit`):
 * hộp đọc sự cố của chuyến khi mở (`GET /api/trips/{id}/exceptions`) — chưa có sự cố nào chưa xử lý thì nút huỷ mờ kèm lý do, như máy
 * chủ (`TRIP_CANCEL_NEEDS_OPEN_EXCEPTION`); huỷ xong toast nói số kiện thành Hoàn trả. Máy chủ từ chối thì câu lỗi hiện trong hộp thoại,
 * không đóng. `tripId` là mã số của máy chủ.
 */
export function BackendCancelTripDialog({ tripId, tripCode, inTransit = false, open, onOpenChange }: {
  tripId: string
  tripCode: string
  inTransit?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const format = useFormat()
  const cancel = useCancelBackendTripMutation(tripId)
  const noteId = useId()
  const exceptions = useBackendTripExceptionsQuery(tripId, open && inTransit)
  // Chưa đọc được sự cố thì chưa cho huỷ: máy chủ vẫn kiểm lại, nhưng nút không nên bấm được trước khi biết lý do
  const blocked = inTransit && !(exceptions.isSuccess && canCancelTrip('delivering', exceptions.data))
  const schema = useMemo(() => z.object({
    reason: z.string().trim().min(1, t('serverPlans.cancel.reasonRequired')).max(MAX_REASON, t('serverPlans.cancel.tooLong')),
  }), [t])
  const form = useForm<CancelValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })
  const reason = useWatch({ control: form.control, name: 'reason' })

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset()
      cancel.reset()
    }
    onOpenChange(next)
  }

  function handleSubmit({ reason: value }: CancelValues) {
    cancel.mutate(value, {
      onSuccess: ({ returned }) => {
        toast.success(returned === null ? t('serverPlans.cancel.done', { code: tripCode }) : t('serverPlans.cancel.doneReturned', { code: tripCode, count: returned }))
        handleOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-120">
        <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader icon={Ban} tone="danger" title={t('serverPlans.cancel.title', { code: tripCode })} description={t(inTransit ? 'serverPlans.cancel.inTransitDescription' : 'serverPlans.cancel.description')} />
          <div className="flex flex-col gap-1.5 px-7 py-5">
            {inTransit && exceptions.isSuccess ? (
              <p id={noteId} role="status" className="mb-2 rounded-md border border-badge-warning-border bg-badge-warning-bg px-3 py-2 text-small text-badge-warning-fg">
                {t(blocked ? 'serverPlans.cancel.inTransitBlocked' : 'serverPlans.cancel.inTransitNote')}
              </p>
            ) : null}
            {inTransit && exceptions.isError ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(exceptions.error, t)}</p> : null}
            <Textarea
              label={t('serverPlans.cancel.reason')}
              placeholder={t('serverPlans.cancel.reasonPlaceholder')}
              error={form.formState.errors.reason?.message}
              {...form.register('reason')}
            />
            <span className="self-end text-note text-ink-3 tabular-nums">
              {t('serverPlans.cancel.counter', { count: format.integer(reason.length), max: format.integer(MAX_REASON) })}
            </span>
            {cancel.isError ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(cancel.error, t)}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>{t('serverPlans.cancel.keep')}</Button>
            <Button type="submit" variant="danger" loading={cancel.isPending} disabled={blocked} aria-describedby={blocked && exceptions.isSuccess ? noteId : undefined}>
              {t('serverPlans.cancel.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
