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
import { useCancelOrderMutation } from './useOrdersQuery'

const MAX_REASON = 300

type CancelValues = { reason: string }

/**
 * Huỷ đơn hàng (LM-104), cùng khuôn với huỷ chuyến: ô icon đỏ, lý do bắt buộc có bộ đếm ký tự, nút nguy hiểm. Kho từ chối (đơn đã gán
 * trong lúc mở hộp thoại) thì câu lỗi hiện ngay trong hộp thoại.
 */
export function CancelOrderDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  return (
    <Dialog open={orderId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-120">
        {orderId ? <CancelForm orderId={orderId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CancelForm({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const cancel = useCancelOrderMutation(orderId)
  const schema = useMemo(() => z.object({
    reason: z.string().trim().min(1, t('orders.cancel.reasonRequired')).max(MAX_REASON, t('orders.form.tooLong', { max: MAX_REASON })),
  }), [t])
  const form = useForm<CancelValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })
  const reason = useWatch({ control: form.control, name: 'reason' })

  function handleSubmit({ reason: value }: CancelValues) {
    cancel.mutate(value, {
      onSuccess: () => {
        toast.success(t('orders.cancel.done', { id: orderId }))
        onClose()
      },
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader icon={Ban} tone="danger" title={t('orders.cancel.title', { id: orderId })} description={t('orders.cancel.description')} />
      <div className="flex flex-col gap-1.5 px-7 py-5">
        <Textarea
          label={t('orders.cancel.reason')}
          placeholder={t('orders.cancel.reasonPlaceholder')}
          error={form.formState.errors.reason?.message}
          {...form.register('reason')}
        />
        <span className="self-end text-note text-ink-3 tabular-nums">{format.integer(reason.length)} / {format.integer(MAX_REASON)}</span>
        {cancel.isError ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(cancel.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('orders.cancel.keep')}</Button>
        <Button type="submit" variant="danger" loading={cancel.isPending}>{t('orders.cancel.confirm')}</Button>
      </DialogFooter>
    </form>
  )
}
