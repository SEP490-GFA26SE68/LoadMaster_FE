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
import { SegregationOverrideDialog } from '@/features/trips/SegregationOverrideDialog'
import { useSegregationGuard } from '@/features/trips/useSegregationQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { stopOfRequirement } from './requirement-list'
import { useAssignableTripsQuery, useAssignRequirementMutation, useRequirementsQuery } from './useRequirementsQuery'

type AssignValues = { requirementId: string; tripId: string }

/**
 * Đưa một yêu cầu chờ xếp chuyến vào một chuyến Nháp / Đã lập kế hoạch (FE-4b-02, FE-4b-04) — của điều phối viên. Hai lối vào: từ màn
 * Yêu cầu giao (yêu cầu đã biết — chọn chuyến) và từ Chi tiết chuyến (chuyến đã biết — chọn yêu cầu). **Không chọn điểm giao**: điểm
 * giao tự sinh theo địa chỉ và toạ độ của yêu cầu (D-73); khi đã chọn đủ yêu cầu và chuyến, hộp thoại nói trước yêu cầu sẽ gộp vào
 * điểm nào đang có, hay chuyến sẽ thêm một điểm mới cuối tuyến. Kho từ chối (chuyến vừa sang vận hành, yêu cầu vừa vào chuyến khác)
 * thì câu lỗi hiện trong hộp thoại. Yêu cầu mang kiện khác loại hàng của chuyến (FE-4b-06, D-74): hộp vượt luật hỏi lý do rồi đưa vào
 * chuyến kèm lý do.
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
  const guard = useSegregationGuard()
  const schema = useMemo(() => z.object({
    requirementId: z.string().min(1, t('requirements.assign.requirementRequired')),
    tripId: z.string().min(1, t('requirements.assign.tripRequired')),
  }), [t])
  const trips = tripsQuery.data ?? []
  // Chỉ yêu cầu kho còn ghi "chờ xếp chuyến" mà không mang kiện có cờ (trạng thái hiển thị cũng là chờ) mới vào chuyến được
  const pending = (requirementsQuery.data ?? []).filter((row) => row.status === 'PENDING')
  const form = useForm<AssignValues>({
    resolver: zodResolver(schema),
    defaultValues: { requirementId: fixedRequirementId ?? '', tripId: fixedTripId ?? '' },
  })
  const [requirementId, tripId] = useWatch({ control: form.control, name: ['requirementId', 'tripId'] })
  const requirement = pending.find((row) => row.requirement.id === requirementId)?.requirement
  const trip = trips.find((item) => item.id === tripId)
  // Điểm giao kho sẽ dùng: cùng luật gộp của kho (`stopKey`) — chỉ để nói trước, kho mới là nơi quyết định
  const target = requirement && trip ? stopOfRequirement(requirement, trip.stops) : null

  function handleSubmit(values: AssignValues) {
    const submit = (overrideReason?: string) => assign.mutateAsync({ ...values, overrideReason }).then(({ requirement: assigned, trip: saved }) => {
      const number = stopOfRequirement(assigned, saved.stops)?.number ?? saved.stops.length
      toast.success(t('requirements.assign.done', { id: assigned.id, trip: saved.name, number }))
      onClose()
    })
    // Lỗi khác vẫn hiện trong hộp thoại (`assign.error`); kiện khác loại hàng thì mở hộp vượt luật
    submit().catch((error: unknown) => { guard.intercept(error, submit) })
  }

  const tripOptions: SelectOption[] = trips.map((item) => ({ value: item.id, label: t('requirements.assign.tripOption', { id: item.id, name: item.name, date: format.date(item.scheduledDate) }) }))
  const requirementOptions: SelectOption[] = pending.map((row) => ({
    value: row.requirement.id,
    label: t('requirements.assign.requirementOption', { id: row.requirement.id, destination: row.requirement.destinationName, count: format.integer(row.packages.length) }),
  }))
  const loading = tripsQuery.isPending || requirementsQuery.isPending
  const fixedTrip = fixedTripId ? trips.find((item) => item.id === fixedTripId) : undefined
  const empty = !loading && (fixedTripId ? pending.length === 0 : trips.length === 0)

  return (
    <>
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
            {fixedRequirementId ? null : <ChoiceField control={form.control} name="requirementId" label={t('requirements.assign.requirement')} options={requirementOptions} />}
            {fixedTripId ? null : <ChoiceField control={form.control} name="tripId" label={t('requirements.assign.trip')} options={tripOptions} />}
            {requirement && trip ? (
              <p role="status" className="rounded-md border border-border bg-surface px-3 py-2.5 text-small text-ink-2">
                {target
                  ? t('requirements.assign.stopMerged', { number: target.number, name: target.name })
                  : t('requirements.assign.stopCreated', { number: trip.stops.length + 1, name: requirement.destinationName })}
                {requirement.lat === undefined ? <span className="mt-1 block text-ink-3">{t('requirements.assign.noCoordinates')}</span> : null}
              </p>
            ) : null}
          </>
        )}
        {assign.isError && guard.pending === null ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(assign.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('requirements.assign.cancel')}</Button>
        <Button type="submit" loading={assign.isPending} disabled={loading || empty}>{t('requirements.assign.submit')}</Button>
      </DialogFooter>
    </form>
    <SegregationOverrideDialog pending={guard.pending} onClose={guard.close} />
    </>
  )
}

/** Select Radix nối RHF. */
function ChoiceField({ control, name, label, options }: {
  control: Control<AssignValues>
  name: keyof AssignValues
  label: string
  options: readonly SelectOption[]
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
          <Select value={field.value} onValueChange={(value) => { if (value !== '') field.onChange(value) }}>
            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} aria-invalid={fieldState.error ? true : undefined}>
              <SelectValue placeholder={t('common.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldMessage error={fieldState.error?.message} />
        </div>
      )}
    />
  )
}
