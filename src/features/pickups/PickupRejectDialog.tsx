import { zodResolver } from '@hookform/resolvers/zod'
import { CircleX } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { MAX_PICKUP_REASON_LENGTH } from '@/lib/mock-db'
import type { PickupRow } from './pickups-api'
import { useRejectPickupMutation } from './usePickupsQuery'

/** Lỗi của form là mã; component dịch. */
const schema = z.object({ reason: z.string().trim().min(1, 'reasonRequired').max(MAX_PICKUP_REASON_LENGTH, 'reasonTooLong') })
type RejectValues = z.infer<typeof schema>

/** Hộp "Từ chối yêu cầu nhận hàng" (FE-7-04): lý do bắt buộc; từ chối xong không có kiện hay điểm nào được tạo. Form dựng lại mỗi lần mở. */
export function PickupRejectDialog({ tripId, row, onOpenChange }: { tripId: string; row: PickupRow | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      {row ? (
        <DialogContent className="w-120">
          <RejectForm tripId={tripId} row={row} onClose={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function RejectForm({ tripId, row, onClose }: { tripId: string; row: PickupRow; onClose: () => void }) {
  const t = useT()
  const reject = useRejectPickupMutation(tripId)
  const form = useForm<RejectValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })
  const code = form.formState.errors.reason?.message
  const error = code === 'reasonRequired'
    ? t('pickups.reject.reasonRequired')
    : code === 'reasonTooLong' ? t('pickups.reject.reasonTooLong', { max: MAX_PICKUP_REASON_LENGTH }) : undefined

  function handleReject({ reason }: RejectValues) {
    reject.mutate({ pickupId: row.request.id, reason }, {
      onSuccess: () => {
        toast.success(t('pickups.reject.done', { id: row.request.id }))
        onClose()
      },
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleReject)}>
      <DialogHeader icon={CircleX} tone="danger" title={t('pickups.reject.title', { id: row.request.id })} description={t('pickups.reject.description')} />
      <div className="flex flex-col gap-3 px-7 py-5">
        <Textarea label={t('pickups.reject.reason')} hint={t('pickups.reject.reasonHint')} error={error} rows={3} aria-required {...form.register('reason')} />
        {reject.isError ? <p role="alert" className="m-0 text-caption text-danger">{dataErrorMessage(reject.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary">{t('pickups.reject.cancel')}</Button></DialogClose>
        <Button type="submit" variant="danger" loading={reject.isPending}>{t('pickups.reject.confirm')}</Button>
      </DialogFooter>
    </form>
  )
}
