import { zodResolver } from '@hookform/resolvers/zod'
import { Ban } from 'lucide-react'
import { useMemo, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import { useCancelTripMutation } from './useTripsQuery'

type CancelValues = { reason: string }

/** Kho giới hạn lý do huỷ ở 300 ký tự (D-45). */
const MAX_REASON = 300

/**
 * Huỷ chuyến Nháp, Đã lập kế hoạch hoặc Đang xếp hàng (D-91, FE-6-07, LM-088; V2.3 `HopThoaiChuyen.jpg`): đầu hộp thoại có ô icon đỏ,
 * lý do bắt buộc kèm bộ đếm ký tự, nút nguy hiểm. Hộp nói trước kiện và yêu cầu giao đi đâu; chuyến đang ở kho thì nói thêm kho được
 * báo — và phải dỡ bao nhiêu kiện đã xếp. Kho từ chối (trạng thái không huỷ được, thiếu lý do) thì câu lỗi hiện ngay trong hộp thoại,
 * không đóng. Đóng hộp thoại trả tiêu điểm về nút mở menu thao tác.
 */
export function CancelTripDialog({ trip, open, onOpenChange, returnFocusTo }: {
  trip: Pick<Trip, 'id' | 'phase' | 'loading'>
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusTo?: RefObject<HTMLElement | null>
}) {
  const t = useT()
  const format = useFormat()
  const tripId = trip.id
  const cancel = useCancelTripMutation(tripId)
  const atWarehouse = trip.phase === 'loading' || trip.phase === 'loaded'
  const loaded = trip.loading?.steps.filter((step) => step.outcome === 'loaded').length ?? 0
  const schema = useMemo(() => z.object({
    reason: z.string().trim().min(1, t('trips.cancel.reasonRequired')).max(MAX_REASON, t('trips.cancel.tooLong')),
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
        toast.success(t('trips.cancel.done', { id: tripId }))
        handleOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-120"
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo?.current) return
          event.preventDefault()
          returnFocusTo.current.focus()
        }}
      >
        <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader icon={Ban} tone="danger" title={t('trips.cancel.title', { id: tripId })} description={t('trips.cancel.description')} />
          <div className="flex flex-col gap-1.5 px-7 py-5">
            {atWarehouse ? (
              <p className="mb-2 rounded-md border border-badge-warning-border bg-badge-warning-bg px-3 py-2 text-small text-badge-warning-fg">
                {loaded > 0 ? t('trips.cancel.loadingNote', { count: loaded }) : t('trips.cancel.stagingNote')}
              </p>
            ) : null}
            <Textarea
              label={t('trips.cancel.reason')}
              placeholder={t('trips.cancel.reasonPlaceholder')}
              error={form.formState.errors.reason?.message}
              {...form.register('reason')}
            />
            <span className="self-end text-note text-ink-3 tabular-nums">
              {t('trips.cancel.counter', { count: format.integer(reason.length), max: format.integer(MAX_REASON) })}
            </span>
            {cancel.isError ? (
              <p role="alert" className="text-caption text-danger">{dataErrorMessage(cancel.error, t)}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              {t('trips.cancel.keep')}
            </Button>
            <Button type="submit" variant="danger" loading={cancel.isPending}>
              {t('trips.cancel.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
