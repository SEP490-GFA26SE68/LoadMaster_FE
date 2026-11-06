import { zodResolver } from '@hookform/resolvers/zod'
import { Link2 } from 'lucide-react'
import { useId, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { FieldLabel, FieldMessage } from '@/components/ui/field-styles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { useAssignableTripsQuery, useAssignRequirementMutation } from './useRequirementsQuery'

type AssignValues = { tripId: string }

/**
 * Đưa một yêu cầu chờ xếp chuyến vào một chuyến khi đọc ghi máy chủ — của điều phối viên, mở từ màn Yêu cầu giao.
 * `POST /api/trips/{tripId}/delivery-requirements/{requirementId}`: máy chủ chỉ nhận chuyến Nháp (`fetchAssignableTrips`) và tự sinh
 * hoặc gộp điểm giao, nên hộp thoại không nói trước điểm nào — toast nói điểm máy chủ trả về. Máy chủ từ chối (yêu cầu chưa nhận đủ
 * kiện, chuyến vừa đổi trạng thái) thì câu lỗi hiện trong hộp thoại.
 */
export function RequirementAssignDialog({ open, onOpenChange, requirementId }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  requirementId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-140">
        {open && requirementId ? <AssignForm requirementId={requirementId} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function AssignForm({ requirementId, onClose }: { requirementId: string; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const id = useId()
  const tripsQuery = useAssignableTripsQuery()
  const assign = useAssignRequirementMutation()
  const schema = useMemo(() => z.object({ tripId: z.string().min(1, t('requirements.assign.tripRequired')) }), [t])
  const form = useForm<AssignValues>({ resolver: zodResolver(schema), defaultValues: { tripId: '' } })
  const trips = tripsQuery.data ?? []
  const loading = tripsQuery.isPending
  const empty = !loading && !tripsQuery.isError && trips.length === 0

  function handleSubmit({ tripId }: AssignValues) {
    const trip = trips.find((item) => item.id === tripId)
    assign.mutate({ requirementId, tripId }, {
      onSuccess: (stop) => {
        toast.success(t('requirements.assign.done', { id: requirementId, trip: trip?.code ?? tripId, number: stop.stopSequence }))
        onClose()
      },
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader icon={Link2} title={t('requirements.assign.titleFor', { id: requirementId })} description={t('requirements.server.assignDescription')} />
      <div className="flex flex-col gap-4 px-7 py-5">
        {loading ? (
          <div className="grid place-items-center py-6"><Spinner /></div>
        ) : tripsQuery.isError ? (
          <p role="alert" className="text-caption text-danger">{dataErrorMessage(tripsQuery.error, t)}</p>
        ) : empty ? (
          <p className="text-body text-ink-2">{t('requirements.server.noDraftTrips')}</p>
        ) : (
          <Controller
            control={form.control}
            name="tripId"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor={id}>{t('requirements.assign.trip')}</FieldLabel>
                <Select value={field.value} onValueChange={(value) => { if (value !== '') field.onChange(value) }}>
                  <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} aria-invalid={fieldState.error ? true : undefined}>
                    <SelectValue placeholder={t('common.selectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {trips.map((trip) => (
                      <SelectItem key={trip.id} value={trip.id}>
                        {t('requirements.assign.tripOption', { id: trip.code, name: trip.name, date: format.date(trip.scheduledDate) })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldMessage error={fieldState.error?.message} />
              </div>
            )}
          />
        )}
        {assign.isError ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(assign.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('requirements.assign.cancel')}</Button>
        <Button type="submit" loading={assign.isPending} disabled={loading || empty || tripsQuery.isError}>{t('requirements.assign.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
