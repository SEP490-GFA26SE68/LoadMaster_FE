import { zodResolver } from '@hookform/resolvers/zod'
import { Link2 } from 'lucide-react'
import { useId, useMemo } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { FieldLabel, FieldMessage } from '@/components/ui/field-styles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { matchingStopId } from './requirement-list'
import { useAssignableTripsQuery, useAssignRequirementMutation, useRequirementsQuery } from './useRequirementsQuery'

type AssignValues = { requirementId: string; tripId: string; stopId: string }

/**
 * Đưa một yêu cầu chờ xếp chuyến vào điểm giao của một chuyến Nháp / Đã lập kế hoạch (FE-4b-02) — của điều phối viên. Hai lối vào: từ
 * màn Yêu cầu giao (yêu cầu đã biết — chọn chuyến rồi điểm giao) và từ Chi tiết chuyến (chuyến đã biết — chọn yêu cầu rồi điểm giao).
 * Chọn yêu cầu hoặc chuyến thì điểm giao trùng tên điểm đến được chọn sẵn. Kho từ chối (chuyến vừa sang vận hành, yêu cầu vừa vào
 * chuyến khác) thì câu lỗi hiện trong hộp thoại. *(tạm)* Chọn điểm giao bằng tay tới khi điểm giao tự sinh (FE-4b-04).
 */
export function RequirementAssignDialog({ open, onOpenChange, requirementId, tripId }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requirementId?: string
  tripId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-140">
        {open ? <AssignForm fixedRequirementId={requirementId} fixedTripId={tripId} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({ fixedRequirementId, fixedTripId, onClose }: { fixedRequirementId?: string; fixedTripId?: string; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const tripsQuery = useAssignableTripsQuery()
  const requirementsQuery = useRequirementsQuery()
  const assign = useAssignRequirementMutation()
  const schema = useMemo(() => z.object({
    requirementId: z.string().min(1, t('requirements.assign.requirementRequired')),
    tripId: z.string().min(1, t('requirements.assign.tripRequired')),
    stopId: z.string().min(1, t('requirements.assign.stopRequired')),
  }), [t])
  const trips = tripsQuery.data ?? []
  // Chỉ yêu cầu kho còn ghi "chờ xếp chuyến" mà không mang kiện có cờ (trạng thái hiển thị cũng là chờ) mới vào chuyến được
  const pending = (requirementsQuery.data ?? []).filter((row) => row.status === 'PENDING')
  const destinationOf = (id: string) => pending.find((row) => row.requirement.id === id)?.requirement.destinationName ?? ''
  const stopsOf = (id: string) => trips.find((trip) => trip.id === id)?.stops ?? []
  const form = useForm<AssignValues>({
    resolver: zodResolver(schema),
    defaultValues: { requirementId: fixedRequirementId ?? '', tripId: fixedTripId ?? '', stopId: '' },
  })
  const [requirementId, tripId, stopId] = useWatch({ control: form.control, name: ['requirementId', 'tripId', 'stopId'] })
  const stops = stopsOf(tripId)
  const suggested = matchingStopId(destinationOf(requirementId), stops)

  // Đổi yêu cầu hoặc chuyến thì chọn lại điểm giao: điểm trùng tên điểm đến, không có thì để trống
  function suggestStop(nextRequirementId: string, nextTripId: string) {
    form.setValue('stopId', matchingStopId(destinationOf(nextRequirementId), stopsOf(nextTripId)) ?? '', { shouldValidate: form.formState.isSubmitted })
  }

  function handleSubmit(values: AssignValues) {
    assign.mutate(values, {
      onSuccess: ({ requirement, trip }) => {
        const number = trip.stops.findIndex((stop) => stop.id === values.stopId) + 1
        toast.success(t('requirements.assign.done', { id: requirement.id, trip: trip.name, number }))
        onClose()
      },
    })
  }

  const tripOptions: SelectOption[] = trips.map((trip) => ({ value: trip.id, label: t('requirements.assign.tripOption', { id: trip.id, name: trip.name, date: format.date(trip.scheduledDate) }) }))
  const requirementOptions: SelectOption[] = pending.map((row) => ({
    value: row.requirement.id,
    label: t('requirements.assign.requirementOption', { id: row.requirement.id, destination: row.requirement.destinationName, count: format.integer(row.packages.length) }),
  }))
  const stopOptions: SelectOption[] = stops.map((stop, index) => ({ value: stop.id, label: t('requirements.assign.stopOption', { number: index + 1, name: stop.name }) }))
  const loading = tripsQuery.isPending || requirementsQuery.isPending
  const fixedTrip = fixedTripId ? trips.find((trip) => trip.id === fixedTripId) : undefined
  const empty = !loading && (fixedTripId ? pending.length === 0 : trips.length === 0)

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader
        icon={Link2}
        title={fixedRequirementId ? t('requirements.assign.titleFor', { id: fixedRequirementId }) : fixedTrip ? t('requirements.assign.titleTrip', { trip: fixedTrip.name }) : t('requirements.assign.title')}
        description={t('requirements.assign.description')}
      />
      <div className="flex flex-col gap-4 px-7 py-5">
        {loading ? (
          <div className="grid place-items-center py-6"><Spinner /></div>
        ) : empty ? (
          <p className="text-body text-ink-2">{fixedTripId ? t('requirements.assign.noRequirements') : t('requirements.assign.noTrips')}</p>
        ) : (
          <>
            {fixedRequirementId ? null : (
              <ChoiceField control={form.control} name="requirementId" label={t('requirements.assign.requirement')} options={requirementOptions}
                onPicked={(value) => suggestStop(value, tripId)} />
            )}
            {fixedTripId ? null : (
              <ChoiceField control={form.control} name="tripId" label={t('requirements.assign.trip')} options={tripOptions}
                onPicked={(value) => suggestStop(requirementId, value)} />
            )}
            {tripId !== '' && stops.length === 0 ? (
              <p className="text-small text-warning">{t('requirements.assign.noStops')}</p>
            ) : (
              <ChoiceField control={form.control} name="stopId" label={t('requirements.assign.stop')} options={stopOptions}
                disabled={tripId === ''} hint={suggested !== undefined && suggested === stopId ? t('requirements.assign.matchHint') : undefined} />
            )}
          </>
        )}
        {assign.isError ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(assign.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('requirements.assign.cancel')}</Button>
        <Button type="submit" loading={assign.isPending} disabled={loading || empty}>{t('requirements.assign.submit')}</Button>
      </DialogFooter>
    </form>
  )
}

/** Select Radix nối RHF, báo lại giá trị vừa chọn để form chọn sẵn điểm giao. */
function ChoiceField({ control, name, label, options, onPicked, disabled = false, hint }: {
  control: Control<AssignValues>
  name: keyof AssignValues
  label: string
  options: readonly SelectOption[]
  onPicked?: (value: string) => void
  disabled?: boolean
  hint?: string
}) {
  const t = useT()
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {/*
            Bỏ qua giá trị rỗng: mục chọn không bao giờ mang '' — Radix chỉ báo '' từ ô <select> ẩn khi giá trị vừa đặt sẵn (điểm giao
            gợi ý) đến trước danh sách mục mới, và báo lại thì mất lựa chọn gợi ý.
          */}
          <Select value={field.value} disabled={disabled} onValueChange={(value) => { if (value === '') return; field.onChange(value); onPicked?.(value) }}>
            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} aria-invalid={fieldState.error ? true : undefined}>
              <SelectValue placeholder={t('common.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldMessage error={fieldState.error?.message} hint={hint} />
        </div>
      )}
    />
  )
}
