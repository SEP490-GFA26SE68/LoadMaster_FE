import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { CoordinatePicker, EMPTY_COORDINATES, parseCoordinates, placeAddress } from '@/components/map'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField, type SelectOption } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { RequirementPackagePicker } from '@/features/requirements/RequirementPackagePicker'
import { useSelectablePackagesQuery } from '@/features/requirements/useRequirementsQuery'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import type { Trip, TripStopTarget } from '@/lib/mock-db'
import { useAddTripPackagesMutation } from './useTripPoolQuery'

/** Giá trị "tạo điểm giao mới" của ô chọn điểm giao. */
const NEW_STOP = 'new'

function pickerSchema(t: TFunction) {
  return z.object({
    packageIds: z.array(z.string()).min(1, t('trips.pool.picker.packagesRequired')),
    stop: z.string().min(1, t('trips.pool.picker.stopRequired')),
    newStop: z.object({ name: z.string(), address: z.string(), coordinates: z.object({ lat: z.string(), lng: z.string() }) }),
  }).superRefine((value, ctx) => {
    if (value.stop !== NEW_STOP) return
    const name = value.newStop.name.trim()
    if (name === '') ctx.addIssue({ code: 'custom', path: ['newStop', 'name'], message: t('trips.create.stopNameRequired') })
    else if (name.length > 120) ctx.addIssue({ code: 'custom', path: ['newStop', 'name'], message: t('trips.create.tooLong') })
    if (value.newStop.address.trim().length > 200) ctx.addIssue({ code: 'custom', path: ['newStop', 'address'], message: t('trips.create.tooLong') })
    // Câu lỗi của từng ô vĩ độ / kinh độ do ô chọn toạ độ tự hiện; ở đây chỉ chặn lưu
    if (parseCoordinates(value.newStop.coordinates.lat, value.newStop.coordinates.lng).kind === 'error') {
      ctx.addIssue({ code: 'custom', path: ['newStop', 'coordinates'], message: t('trips.stops.add.coordinatesInvalid') })
    }
  })
}

type PickerValues = z.infer<ReturnType<typeof pickerSchema>>

/** Điểm giao nhận kiện theo lựa chọn của form: điểm đang có, hoặc điểm tay mới (toạ độ chỉ gửi khi đủ hai ô). */
function targetOf(values: PickerValues): TripStopTarget {
  if (values.stop !== NEW_STOP) return { stopId: values.stop }
  const point = parseCoordinates(values.newStop.coordinates.lat, values.newStop.coordinates.lng)
  return { newStop: { name: values.newStop.name.trim(), address: values.newStop.address.trim(), ...(point.kind === 'ok' ? { lat: point.lat, lng: point.lng } : {}) } }
}

/**
 * "Thêm kiện từ kho kiện" ở Chi tiết chuyến (FE-4b-05, D-68 đường 2): điều phối viên chọn kiện Đã nhập — không cờ, chưa thuộc yêu cầu
 * giao nào (cùng ô chọn kiện của form yêu cầu giao) — rồi gán vào một **điểm giao tay** đang có của chuyến hoặc tạo điểm tay mới (tên,
 * địa chỉ, toạ độ qua ô chọn toạ độ). Kiện đi đường này không có hạn giao; điểm tự sinh của yêu cầu giao không nằm trong ô chọn. Kho
 * từ chối (kiện vừa bị yêu cầu khác lấy, chuyến vừa sang vận hành) thì câu lỗi hiện trong hộp thoại.
 */
export function PoolPackagePicker({ open, onOpenChange, trip }: { open: boolean; onOpenChange: (open: boolean) => void; trip: Trip }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-220">
        {open ? <PickerForm trip={trip} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function PickerForm({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const t = useT()
  const selectable = useSelectablePackagesQuery()
  const add = useAddTripPackagesMutation(trip.id)
  const schema = useMemo(() => pickerSchema(t), [t])
  const manualStops = trip.stops.map((stop, index) => ({ stop, number: index + 1 })).filter(({ stop }) => stop.generated !== true)
  const stopOptions: SelectOption[] = [
    ...manualStops.map(({ stop, number }) => ({ value: stop.id, label: t('trips.pool.picker.stopOption', { number, name: stop.name }) })),
    { value: NEW_STOP, label: t('trips.pool.picker.newStop') },
  ]
  const form = useForm<PickerValues>({
    resolver: zodResolver(schema),
    defaultValues: { packageIds: [], stop: manualStops[0]?.stop.id ?? NEW_STOP, newStop: { name: '', address: '', coordinates: EMPTY_COORDINATES } },
  })
  const stop = useWatch({ control: form.control, name: 'stop' })
  const errors = form.formState.errors.newStop

  function handleSubmit(values: PickerValues) {
    add.mutate({ packageIds: values.packageIds, target: targetOf(values) }, {
      onSuccess: (saved) => {
        const number = values.stop === NEW_STOP ? saved.stops.length : saved.stops.findIndex((item) => item.id === values.stop) + 1
        toast.success(t('trips.pool.picker.done', { count: values.packageIds.length, number }))
        onClose()
      },
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader icon={PackagePlus} title={t('trips.pool.picker.title')} description={t('trips.pool.picker.description')} />
      <div className="grid gap-5 px-7 py-5 md:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <SelectField control={form.control} name="stop" label={t('trips.pool.picker.stop')} options={stopOptions} hint={t('trips.pool.picker.stopHint')} />
          {stop === NEW_STOP ? (
            <>
              <Input label={t('trips.stops.add.name')} required error={errors?.name?.message} {...form.register('newStop.name')} />
              <Input label={t('trips.stops.add.address')} error={errors?.address?.message} {...form.register('newStop.address')} />
              <Controller
                control={form.control}
                name="newStop.coordinates"
                render={({ field }) => (
                  <CoordinatePicker
                    label={t('trips.stops.add.coordinates')}
                    value={field.value}
                    onChange={field.onChange}
                    showErrors={form.formState.isSubmitted}
                    onPlacePicked={(place) => {
                      if (form.getValues('newStop.address').trim() === '') form.setValue('newStop.address', placeAddress(place), { shouldDirty: true })
                    }}
                  />
                )}
              />
            </>
          ) : null}
        </div>
        {selectable.isPending ? (
          <div className="grid place-items-center py-8"><Spinner /></div>
        ) : (
          <Controller
            control={form.control}
            name="packageIds"
            render={({ field, fieldState }) => (
              <RequirementPackagePicker packages={selectable.data ?? []} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
        )}
        {add.isError ? <p role="alert" className="text-caption text-danger md:col-span-2">{dataErrorMessage(add.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('trips.pool.picker.cancel')}</Button>
        <Button type="submit" loading={add.isPending}>{t('trips.pool.picker.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
