import { zodResolver } from '@hookform/resolvers/zod'
import { CircleX } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { useT } from '@/lib/i18n'
import type { TripClaimRow } from './trip-claims-api'

const MAX_REASON_LENGTH = 300
const schema = z.object({ reason: z.string().trim().min(1, 'reasonRequired').max(MAX_REASON_LENGTH, 'reasonTooLong') })
type RejectValues = z.infer<typeof schema>

/** Hộp từ chối phiếu xin chuyến; lý do bắt buộc và không dài quá 300 ký tự như DTO backend. */
export function TripClaimRejectDialog({ row, pending, onOpenChange, onConfirm }: {
  row: Pick<TripClaimRow, 'driverName'> | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
}) {
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      {row ? (
        <DialogContent className="w-120">
          <RejectForm row={row} pending={pending} onConfirm={onConfirm} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function RejectForm({ row, pending, onConfirm }: { row: Pick<TripClaimRow, 'driverName'>; pending: boolean; onConfirm: (reason: string) => void }) {
  const t = useT()
  const form = useForm<RejectValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })
  const code = form.formState.errors.reason?.message
  const error = code === 'reasonRequired'
    ? t('tripClaims.rejectDialog.reasonRequired')
    : code === 'reasonTooLong' ? t('tripClaims.rejectDialog.reasonTooLong', { max: MAX_REASON_LENGTH }) : undefined

  return (
    <form noValidate onSubmit={form.handleSubmit(({ reason }) => onConfirm(reason))}>
      <DialogHeader
        icon={CircleX}
        tone="danger"
        title={t('tripClaims.rejectDialog.title', { name: row.driverName })}
        description={t('tripClaims.rejectDialog.description')}
      />
      <div className="px-7 py-5">
        <Textarea
          label={t('tripClaims.rejectDialog.reason')}
          hint={t('tripClaims.rejectDialog.reasonHint', { max: MAX_REASON_LENGTH })}
          error={error}
          rows={3}
          aria-required
          {...form.register('reason')}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={pending}>{t('tripClaims.rejectDialog.cancel')}</Button>
        </DialogClose>
        <Button type="submit" variant="danger" loading={pending}>{t('tripClaims.rejectDialog.confirm')}</Button>
      </DialogFooter>
    </form>
  )
}
