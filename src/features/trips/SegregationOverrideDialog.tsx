import { zodResolver } from '@hookform/resolvers/zod'
import { TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { OVERRIDE_REASON_MAX_LENGTH } from '@/domain/constraints'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { SegregationPending } from './useSegregationQuery'

type OverrideValues = { reason: string }

/**
 * Hộp vượt luật phân tách hàng (FE-4b-06, D-74): một chuyến chỉ chở một loại hàng; điều phối viên vẫn đưa được kiện khác loại vào
 * chuyến khi ghi lý do — bắt buộc, tối đa 500 ký tự, có bộ đếm. Hộp thoại nói loại hàng của chuyến và các kiện khác loại, rồi gọi
 * lại đúng lần ghi đang chờ (`pending.retry`) kèm lý do. Kho từ chối thì câu lỗi hiện ngay trong hộp thoại, không đóng. Mở từ một
 * hộp thoại khác thì phải đặt **ngoài `<form>` của hộp thoại đó** (AGENTS mục 9).
 */
export function SegregationOverrideDialog({ pending, onClose, onDone }: {
  /** Lần ghi đang chờ lý do; `null` thì hộp thoại đóng. */
  pending: SegregationPending | null
  onClose: () => void
  /** Sau khi lần ghi kèm lý do thành công (hộp thoại đã đóng). */
  onDone?: () => void
}) {
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-130">
        {pending ? <OverrideForm pending={pending} onClose={onClose} onDone={onDone} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function OverrideForm({ pending, onClose, onDone }: { pending: SegregationPending; onClose: () => void; onDone?: () => void }) {
  const t = useT()
  const format = useFormat()
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const max = OVERRIDE_REASON_MAX_LENGTH
  const schema = useMemo(() => z.object({
    reason: z.string().trim().min(1, t('trips.segregation.dialog.reasonRequired')).max(max, t('trips.segregation.dialog.reasonTooLong', { max: format.integer(max) })),
  }), [t, format, max])
  const form = useForm<OverrideValues>({ resolver: zodResolver(schema), defaultValues: { reason: pending.initialReason ?? '' } })
  const reason = useWatch({ control: form.control, name: 'reason' })

  function handleSubmit(values: OverrideValues) {
    setSubmitting(true)
    setFailure(null)
    pending.retry(values.reason.trim()).then(
      () => { onClose(); onDone?.() },
      (error: unknown) => { setFailure(error); setSubmitting(false) },
    )
  }

  return (
    <form noValidate onSubmit={(event) => { event.stopPropagation(); void form.handleSubmit(handleSubmit)(event) }}>
      <DialogHeader icon={TriangleAlert} tone="warning" title={t('trips.segregation.dialog.title')} description={t('trips.segregation.dialog.description')} />
      <div className="flex flex-col gap-4 px-7 py-5">
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 text-small">
          <dt className="text-ink-3">{t('trips.segregation.locked')}</dt>
          <dd className="m-0"><HandlingClassChip handlingClass={pending.lockedClass} /></dd>
          <dt className="self-start pt-0.5 text-ink-3">{t('trips.segregation.dialog.packages')}</dt>
          <dd className="m-0 font-mono text-caption leading-5 text-ink-strong">{format.list([...pending.packages])}</dd>
        </dl>
        <div className="flex flex-col gap-1.5">
          <Textarea
            label={t('trips.segregation.dialog.reason')}
            aria-required
            rows={4}
            error={form.formState.errors.reason?.message}
            {...form.register('reason')}
          />
          <span className="self-end text-note text-ink-3 tabular-nums">
            {t('trips.cancel.counter', { count: format.integer(reason.length), max: format.integer(max) })}
          </span>
        </div>
        {failure === null ? null : <p role="alert" className="text-caption text-danger">{dataErrorMessage(failure, t)}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('trips.segregation.dialog.cancel')}</Button>
        <Button type="submit" loading={submitting}>{t('trips.segregation.dialog.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
