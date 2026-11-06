import { zodResolver } from '@hookform/resolvers/zod'
import { Ban } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { useCancelBackendTripMutation } from './useTripEditBackendQuery'

type CancelValues = { reason: string }

/** Máy chủ giới hạn lý do huỷ ở 500 ký tự (`TripCancelRequest`). */
const MAX_REASON = 500

/**
 * Huỷ chuyến bản máy chủ (`POST /api/trips/{id}/cancel`): lý do bắt buộc kèm bộ đếm, nút nguy hiểm. Máy chủ từ chối (trạng thái không
 * huỷ được) thì câu lỗi hiện trong hộp thoại, không đóng. `tripId` là mã số của máy chủ.
 */
export function BackendCancelTripDialog({ tripId, tripCode, open, onOpenChange }: {
  tripId: string
  tripCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const format = useFormat()
  const cancel = useCancelBackendTripMutation(tripId)
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
      onSuccess: () => {
        toast.success(t('serverPlans.cancel.done', { code: tripCode }))
        handleOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-120">
        <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader icon={Ban} tone="danger" title={t('serverPlans.cancel.title', { code: tripCode })} description={t('serverPlans.cancel.description')} />
          <div className="flex flex-col gap-1.5 px-7 py-5">
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
            <Button type="submit" variant="danger" loading={cancel.isPending}>{t('serverPlans.cancel.confirm')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
