import { zodResolver } from '@hookform/resolvers/zod'
import { TriangleAlert } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { MAX_EXCEPTION_DELAY_MINUTES, MAX_EXCEPTION_NOTE_LENGTH, TRIP_EXCEPTION_TYPES } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { useReportExceptionMutation } from './useMonitoringQuery'

/** Lỗi của form là mã; component dịch qua `monitoring.reportDialog.errors`. */
const schema = z.object({
  type: z.enum(TRIP_EXCEPTION_TYPES, 'typeRequired'),
  description: z.string().trim().min(1, 'detailsRequired').max(MAX_EXCEPTION_NOTE_LENGTH, 'detailsTooLong'),
  delayMinutes: z.string().trim().regex(/^\d{1,3}$/, 'delayInvalid').refine((value) => Number(value) <= MAX_EXCEPTION_DELAY_MINUTES, 'delayInvalid'),
})
type ReportInput = z.input<typeof schema>
type ReportValues = z.output<typeof schema>

const ERRORS = ['typeRequired', 'detailsRequired', 'detailsTooLong', 'delayInvalid'] as const
const isError = (code: string | undefined): code is (typeof ERRORS)[number] => ERRORS.some((item) => item === code)

/**
 * Hộp "Báo sự cố" của một chuyến Đang vận chuyển (FE-6-11, D-87): loại (5 loại, nhãn ở `common.tripExceptionTypes`), mô tả và số phút
 * dự kiến chậm. Dùng ở màn Giám sát (điều phối viên) và ở màn điểm giao của tài xế (`touch`: chữ 16 px, ô và nút 56 px, dưới 768 px là tờ trượt từ đáy). Form dựng lại
 * mỗi lần mở.
 */
export function ReportExceptionDialog({ tripId, open, onOpenChange, touch = false }: { tripId: string; open: boolean; onOpenChange: (open: boolean) => void; touch?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent sheet={touch} className="w-[min(34rem,calc(100vw-3rem))]">
          <ReportForm tripId={tripId} touch={touch} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function ReportForm({ tripId, touch, onDone }: { tripId: string; touch: boolean; onDone: () => void }) {
  const t = useT()
  const report = useReportExceptionMutation(tripId)
  const form = useForm<ReportInput, unknown, ReportValues>({ resolver: zodResolver(schema), defaultValues: { description: '', delayMinutes: '' } })
  const { errors } = form.formState
  const message = (code: string | undefined) => (isError(code) ? t(`monitoring.reportDialog.errors.${code}`, { max: code === 'delayInvalid' ? MAX_EXCEPTION_DELAY_MINUTES : MAX_EXCEPTION_NOTE_LENGTH }) : undefined)
  const typeError = message(errors.type?.message)
  const size = touch ? 'touch' : 'md'

  function handleReport({ type, description, delayMinutes }: ReportValues) {
    report.mutate({ type, description, delayMinutes: Number(delayMinutes) }, {
      onSuccess: (exception) => {
        toast.success(t('monitoring.exceptions.done.reported', { id: exception.id }))
        onDone()
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <form noValidate className={touch ? 'text-body-lg' : undefined} onSubmit={form.handleSubmit(handleReport)}>
      <DialogHeader icon={TriangleAlert} tone="warning" title={t('monitoring.reportDialog.title', { id: tripId })} description={t('monitoring.reportDialog.description')} />
      <div className="flex flex-col gap-4 px-7 py-5 max-sm:px-5">
        <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0" aria-invalid={typeError ? true : undefined}>
          <legend className="mb-1.5 p-0 text-small font-semibold text-ink-2">{t('monitoring.reportDialog.type')}</legend>
          <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            {TRIP_EXCEPTION_TYPES.map((type) => (
              <label
                key={type}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 has-checked:border-primary has-checked:bg-primary-bg',
                  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
                  touch ? 'min-h-14' : 'min-h-10',
                )}
              >
                <input type="radio" value={type} className="size-4.5 flex-none accent-primary outline-none" {...form.register('type')} />
                {t(`common.tripExceptionTypes.${type}`)}
              </label>
            ))}
          </div>
          {typeError ? <span role="alert" className="text-fine text-danger">{typeError}</span> : null}
        </fieldset>
        <Textarea
          label={t('monitoring.reportDialog.details')}
          hint={t('monitoring.reportDialog.detailsHint')}
          error={message(errors.description?.message)}
          rows={3}
          aria-required
          {...form.register('description')}
        />
        <Input
          label={t('monitoring.reportDialog.delay')}
          hint={t('monitoring.reportDialog.delayHint', { max: MAX_EXCEPTION_DELAY_MINUTES })}
          error={message(errors.delayMinutes?.message)}
          inputMode="numeric"
          numeric
          suffix={t('monitoring.reportDialog.minutes')}
          className={touch ? 'h-14 text-body-lg' : undefined}
          aria-required
          {...form.register('delayMinutes')}
        />
      </div>
      <DialogFooter className={touch ? 'sticky bottom-0' : undefined}>
        <DialogClose asChild>
          <Button type="button" variant="secondary" size={size} className={touch ? 'max-md:flex-1' : undefined}>{t('monitoring.reportDialog.cancel')}</Button>
        </DialogClose>
        <Button type="submit" size={size} className={touch ? 'max-md:flex-1' : undefined} loading={report.isPending}>{t('monitoring.reportDialog.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
