import { zodResolver } from '@hookform/resolvers/zod'
import { CircleX } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { useT } from '@/lib/i18n'
import { MAX_MANUAL_NOTE_LENGTH } from '@/lib/mock-db'
import type { ManualConfirmRow } from './manual-confirm-api'

/** Lỗi của form là mã; component dịch. */
const schema = z.object({ reason: z.string().trim().min(1, 'reasonRequired').max(MAX_MANUAL_NOTE_LENGTH, 'reasonTooLong') })
type RejectValues = z.infer<typeof schema>

/**
 * Hộp "Từ chối xác nhận tay" (FE-6-04): lý do bắt buộc — người gửi đọc nó để biết phải kiểm lại gì. Form dựng lại mỗi lần mở.
 */
export function ManualConfirmRejectDialog({ row, pending, onOpenChange, onConfirm }: {
  /** Xác nhận tay sắp bị từ chối; `null` là hộp đóng. */
  row: ManualConfirmRow | null
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

function RejectForm({ row, pending, onConfirm }: { row: ManualConfirmRow; pending: boolean; onConfirm: (reason: string) => void }) {
  const t = useT()
  const form = useForm<RejectValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })
  const code = form.formState.errors.reason?.message
  const error = code === 'reasonRequired'
    ? t('trips.manualConfirms.rejectDialog.reasonRequired')
    : code === 'reasonTooLong' ? t('trips.manualConfirms.rejectDialog.reasonTooLong', { max: MAX_MANUAL_NOTE_LENGTH }) : undefined

  return (
    <form noValidate onSubmit={form.handleSubmit(({ reason }) => onConfirm(reason))}>
      <DialogHeader
        icon={CircleX}
        tone="danger"
        title={t('trips.manualConfirms.rejectDialog.title', { id: row.packageInstanceId })}
        description={t('trips.manualConfirms.rejectDialog.description')}
      />
      <div className="px-7 py-5">
        <Textarea
          label={t('trips.manualConfirms.rejectDialog.reason')}
          hint={t('trips.manualConfirms.rejectDialog.reasonHint')}
          error={error}
          rows={3}
          aria-required
          {...form.register('reason')}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">{t('trips.manualConfirms.rejectDialog.cancel')}</Button>
        </DialogClose>
        <Button type="submit" variant="danger" loading={pending}>{t('trips.manualConfirms.rejectDialog.confirm')}</Button>
      </DialogFooter>
    </form>
  )
}
