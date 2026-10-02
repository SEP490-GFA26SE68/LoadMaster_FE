import { zodResolver } from '@hookform/resolvers/zod'
import { MapPinPlus } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { CoordinatePicker, EMPTY_COORDINATES, parseCoordinates, placeAddress } from '@/components/map'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import type { ManualStopInput } from './trip-stops-api'
import { useAddStopMutation } from './useTripsQuery'

/** Số điện thoại dạng hiển thị, như form chuyến. */
const PHONE = /^[0-9+().\s-]*$/

function stopSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(1, t('trips.create.stopNameRequired')).max(120, t('trips.create.tooLong')),
    address: z.string().trim().max(200, t('trips.create.tooLong')),
    phone: z.string().trim().max(20, t('trips.create.tooLong')).regex(PHONE, t('trips.create.phoneInvalid')),
    contactName: z.string().trim().max(120, t('trips.create.tooLong')),
    coordinates: z.object({ lat: z.string(), lng: z.string() }),
  }).superRefine((value, ctx) => {
    // Câu lỗi của từng ô do ô chọn toạ độ tự hiện; ở đây chỉ chặn lưu
    if (parseCoordinates(value.coordinates.lat, value.coordinates.lng).kind === 'error') {
      ctx.addIssue({ code: 'custom', path: ['coordinates'], message: t('trips.stops.add.coordinatesInvalid') })
    }
  })
}

type StopFormValues = z.infer<ReturnType<typeof stopSchema>>

/** Đầu vào ghi vào kho: toạ độ chỉ gửi khi đủ hai ô. */
function manualStopInput(values: StopFormValues): ManualStopInput {
  const point = parseCoordinates(values.coordinates.lat, values.coordinates.lng)
  return {
    name: values.name.trim(), address: values.address.trim(), phone: values.phone.trim(), contactName: values.contactName.trim(),
    ...(point.kind === 'ok' ? { lat: point.lat, lng: point.lng } : {}),
  }
}

/**
 * Thêm **điểm giao tay** vào chuyến đang lập kế hoạch (FE-4b-04, D-73) — cho kiện lẻ: kiện thêm ngay trong chuyến, kiện đưa thẳng từ
 * kho kiện. Tên, địa chỉ, toạ độ qua ô chọn toạ độ (FE-4b-03), số điện thoại và người liên hệ cho tài xế; không có hạn. Điểm của yêu
 * cầu giao không thêm ở đây: chúng tự sinh khi đưa yêu cầu vào chuyến. Điểm mới nằm cuối tuyến.
 */
export function StopFormDialog({ open, onOpenChange, tripId }: { open: boolean; onOpenChange: (open: boolean) => void; tripId: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-150">
        {open ? <StopForm tripId={tripId} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function StopForm({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const t = useT()
  const add = useAddStopMutation(tripId)
  const schema = useMemo(() => stopSchema(t), [t])
  const form = useForm<StopFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', address: '', phone: '', contactName: '', coordinates: EMPTY_COORDINATES },
  })
  const { errors } = form.formState

  function handleSubmit(values: StopFormValues) {
    add.mutate(manualStopInput(values), {
      onSuccess: (trip) => {
        toast.success(t('trips.stops.add.done', { number: trip.stops.length, name: values.name.trim() }))
        onClose()
      },
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader icon={MapPinPlus} title={t('trips.stops.add.title')} description={t('trips.stops.add.description')} />
      <div className="flex flex-col gap-3.5 px-7 py-5">
        <Input label={t('trips.stops.add.name')} required error={errors.name?.message} {...form.register('name')} />
        <Input label={t('trips.stops.add.address')} error={errors.address?.message} {...form.register('address')} />
        <Controller
          control={form.control}
          name="coordinates"
          render={({ field }) => (
            <CoordinatePicker
              label={t('trips.stops.add.coordinates')}
              value={field.value}
              onChange={field.onChange}
              showErrors={form.formState.isSubmitted}
              onPlacePicked={(place) => {
                if (form.getValues('address').trim() === '') form.setValue('address', placeAddress(place), { shouldDirty: true })
              }}
            />
          )}
        />
        <div className="grid items-start gap-3.5 sm:grid-cols-2">
          <Input type="tel" autoComplete="off" label={t('trips.stops.add.phone')} error={errors.phone?.message} {...form.register('phone')} />
          <Input label={t('trips.stops.add.contactName')} error={errors.contactName?.message} {...form.register('contactName')} />
        </div>
        {add.isError ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(add.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('trips.stops.add.cancel')}</Button>
        <Button type="submit" loading={add.isPending}>{t('trips.stops.add.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
