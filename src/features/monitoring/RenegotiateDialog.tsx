import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock } from 'lucide-react'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { deadlineIso, deadlineParts } from '@/features/requirements/requirement-form'
import type { TripRequirement } from '@/features/trips/trip-extras-api'
import { useTripRequirementsQuery } from '@/features/trips/useTripExtrasQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { MAX_EXCEPTION_NOTE_LENGTH } from '@/lib/mock-db'
import type { EscalationRow } from './monitoring-view'
import { useRenegotiateDeadlineMutation } from './useMonitoringQuery'
import { useMoment } from './useMoment'

/** Lỗi của form là mã; component dịch qua `monitoring.renegotiate.errors`. Hạn có ở tương lai hay không do kho xét theo đồng hồ của nó. */
const schema = z
  .object({
    requirementId: z.string().min(1, 'requirementRequired'),
    contactNote: z.string().trim().min(1, 'noteRequired').max(MAX_EXCEPTION_NOTE_LENGTH, 'noteTooLong'),
    date: z.string(),
    time: z.string(),
  })
  .refine((value) => deadlineIso(value.date, value.time) !== null, { path: ['date'], message: 'deadlineInvalid' })
type RenegotiateValues = z.infer<typeof schema>

const ERRORS = ['requirementRequired', 'noteRequired', 'noteTooLong', 'deadlineInvalid'] as const
const isError = (code: string | undefined): code is (typeof ERRORS)[number] => ERRORS.some((item) => item === code)

/**
 * Hộp "Liên hệ khách và nhập hạn mới" của quản lý công ty (FE-6-12, D-66, D-87): chọn yêu cầu giao của chuyến còn đang giao, ghi lại
 * việc đã liên hệ khách và nhập hạn mới (ngày + giờ theo giờ của máy, như form yêu cầu giao). Kho từ chối hạn không ở tương lai theo
 * đồng hồ của nó; hạn của điểm giao và mức hạn tính lại ngay. Form dựng lại mỗi lần mở, sau khi tải xong yêu cầu giao của chuyến.
 */
export function RenegotiateDialog({ row, onOpenChange }: { /** Sự cố sắp gia hạn; `null` là hộp đóng. */ row: EscalationRow | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      {row ? (
        <DialogContent className="w-[min(36rem,calc(100vw-3rem))]">
          <RenegotiateBody row={row} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function RenegotiateBody({ row, onDone }: { row: EscalationRow; onDone: () => void }) {
  const t = useT()
  const query = useTripRequirementsQuery(row.trip.tripId)
  // Yêu cầu còn đang giao và còn điểm giao trong chuyến mới gia hạn được
  const open = (query.data ?? []).filter((item) => item.status === 'IN_TRIP' && item.stopNumber !== undefined)
  const header = (
    <DialogHeader
      icon={CalendarClock}
      title={t('monitoring.renegotiate.title')}
      description={t('monitoring.renegotiate.description', { id: row.exception.id, tripId: row.trip.tripId })}
    />
  )
  if (query.isPending || query.isError || open.length === 0) {
    return (
      <>
        {header}
        <div className="px-7 py-5 max-sm:px-5">
          {query.isPending ? <div className="flex justify-center py-6"><Spinner /></div>
            : <Banner tone={query.isError ? 'danger' : 'info'}>{query.isError ? dataErrorMessage(query.error, t) : t('monitoring.renegotiate.noRequirements')}</Banner>}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">{t('monitoring.renegotiate.cancel')}</Button></DialogClose>
        </DialogFooter>
      </>
    )
  }
  return <RenegotiateForm row={row} requirements={open} header={header} onDone={onDone} />
}

function RenegotiateForm({ row, requirements, header, onDone }: { row: EscalationRow; requirements: readonly TripRequirement[]; header: React.ReactNode; onDone: () => void }) {
  const t = useT()
  const format = useFormat()
  const renegotiate = useRenegotiateDeadlineMutation(row.trip.tripId, row.exception.id)
  // Chọn sẵn yêu cầu ở điểm xe đang tới lúc báo sự cố, không có thì yêu cầu đầu tiên
  const initial = requirements.find((item) => item.stopNumber === row.exception.stopNumber) ?? requirements[0]
  const parts = initial ? deadlineParts(initial.requirement.deadline) : { deadlineDate: '', deadlineTime: '' }
  const form = useForm<RenegotiateValues>({
    resolver: zodResolver(schema),
    defaultValues: { requirementId: initial?.requirement.id ?? '', contactNote: '', date: parts.deadlineDate, time: parts.deadlineTime },
  })
  const { errors } = form.formState
  const message = (code: string | undefined) => (isError(code) ? t(`monitoring.renegotiate.errors.${code}`, { max: MAX_EXCEPTION_NOTE_LENGTH }) : undefined)

  function handleSave({ requirementId, contactNote, date, time }: RenegotiateValues) {
    const deadline = deadlineIso(date, time)
    if (deadline === null) return
    renegotiate.mutate({ requirementId, deadline, contactNote }, {
      onSuccess: () => {
        toast.success(t('monitoring.renegotiate.done', { requirementId }))
        onDone()
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSave)}>
      {header}
      <div className="flex flex-col gap-4 px-7 py-5 max-sm:px-5">
        <SelectField
          control={form.control}
          name="requirementId"
          label={t('monitoring.renegotiate.requirement')}
          placeholder={t('monitoring.renegotiate.requirementPlaceholder')}
          options={requirements.map(({ requirement, stopNumber }) => ({
            value: requirement.id,
            label: t('monitoring.renegotiate.requirementOption', { id: requirement.id, destination: requirement.destinationName, number: format.integer(stopNumber ?? 0) }),
          }))}
          hint={<CurrentDeadline control={form.control} row={row} requirements={requirements} />}
        />
        <Textarea
          label={t('monitoring.renegotiate.contactNote')}
          hint={t('monitoring.renegotiate.contactHint')}
          error={message(errors.contactNote?.message)}
          rows={3}
          aria-required
          {...form.register('contactNote')}
        />
        <div className="grid items-start gap-3.5 sm:grid-cols-[minmax(0,1fr)_132px]">
          <Input type="date" label={t('monitoring.renegotiate.date')} required error={message(errors.date?.message)} {...form.register('date')} />
          <Input type="time" label={t('monitoring.renegotiate.time')} required {...form.register('time')} />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary">{t('monitoring.renegotiate.cancel')}</Button></DialogClose>
        <Button type="submit" loading={renegotiate.isPending}>{t('monitoring.renegotiate.submit')}</Button>
      </DialogFooter>
    </form>
  )
}

/** Hạn hiện tại của yêu cầu đang chọn và giờ đến dự kiến của điểm giao của nó — con số quản lý cần khi thoả thuận hạn mới. */
function CurrentDeadline({ control, row, requirements }: { control: Control<RenegotiateValues>; row: EscalationRow; requirements: readonly TripRequirement[] }) {
  const t = useT()
  const moment = useMoment()
  const requirementId = useWatch({ control, name: 'requirementId' })
  const chosen = requirements.find((item) => item.requirement.id === requirementId)
  if (!chosen) return null
  const eta = row.stops.find((stop) => stop.number === chosen.stopNumber)?.eta
  const deadline = moment(chosen.requirement.deadline)
  return <>{eta === undefined ? t('monitoring.renegotiate.current', { deadline }) : t('monitoring.renegotiate.currentEta', { deadline, eta: moment(eta) })}</>
}
