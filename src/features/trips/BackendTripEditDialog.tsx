import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField, type SelectOption } from '@/components/ui/SelectField'
import { useCompanyWarehousesQuery } from '@/features/company-warehouses/useCompanyWarehousesQuery'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import { compareText } from '@/lib/list-filter'
import { departureAtOf, driverIdOf, UNASSIGNED } from './trip-form.schema'
import type { BackendTripChanges } from './trip-edit-backend-api'
import type { TripDetailApiResponse, TripFormOptions } from './trips-api'
import { useUpdateBackendTripMutation } from './useTripEditBackendQuery'
import { useTripFormOptionsQuery } from './useTripsQuery'

/** Giá trị "giữ kho hiện tại": máy chủ không trả mã kho của chuyến, chỉ tên và địa chỉ. */
const KEEP_WAREHOUSE = 'keep'

function editSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(1, t('serverPlans.edit.nameRequired')).max(120, t('serverPlans.edit.tooLong')),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('serverPlans.edit.dateRequired')),
    time: z.string().regex(/^\d{2}:\d{2}$/, t('serverPlans.edit.timeRequired')),
    vehicleId: z.string().min(1),
    driverId: z.string(),
    warehouseId: z.string(),
  })
}

type EditValues = z.infer<ReturnType<typeof editSchema>>

/** Giá trị ban đầu: giờ xuất phát của máy chủ là `LocalDateTime` giờ Việt Nam, đọc thẳng ngày và giờ. */
function defaultsOf(trip: TripDetailApiResponse): EditValues {
  const local = trip.departureTime.replace(' ', 'T')
  return {
    name: trip.tripName,
    date: local.slice(0, 10),
    time: local.slice(11, 16),
    vehicleId: String(trip.vehicleId),
    driverId: trip.driverId === null ? UNASSIGNED : String(trip.driverId),
    warehouseId: KEEP_WAREHOUSE,
  }
}

/** Chỉ gửi trường người dùng đã đổi; không đổi gì thì `null`. */
function tripChangesOf(initial: EditValues, values: EditValues): BackendTripChanges | null {
  const changes: { -readonly [K in keyof BackendTripChanges]: BackendTripChanges[K] } = {}
  if (values.name.trim() !== initial.name.trim()) changes.name = values.name.trim()
  if (values.date !== initial.date || values.time !== initial.time) changes.departureAt = departureAtOf({ scheduledDate: values.date, departureTime: values.time })
  if (values.vehicleId !== initial.vehicleId) changes.vehicleId = values.vehicleId
  if (values.driverId !== initial.driverId) changes.driverId = driverIdOf(values.driverId)
  if (values.warehouseId !== KEEP_WAREHOUSE) changes.originWarehouseId = values.warehouseId
  return Object.keys(changes).length === 0 ? null : changes
}

/** Xe bảo dưỡng hiện kèm lý do, không chọn được — trừ xe chuyến đang dùng. Tài xế: người đang hoạt động, cộng tài xế đang gán. */
function choicesOf(data: TripFormOptions | undefined, initial: EditValues, t: TFunction) {
  const vehicles: SelectOption[] = (data?.vehicles ?? []).map(({ vehicle, status }) => {
    const maintenance = status === 'maintenance'
    return {
      value: vehicle.id,
      label: maintenance ? t('trips.create.vehicleMaintenance', { name: vehicle.name }) : vehicle.name,
      disabled: maintenance && vehicle.id !== initial.vehicleId,
    }
  })
  const drivers: SelectOption[] = (data?.drivers ?? [])
    .filter((user) => user.status === 'active' || user.id === initial.driverId)
    .toSorted((a, b) => compareText(a.fullName, b.fullName))
    .map((user) => ({ value: user.id, label: user.fullName }))
  return { vehicles, drivers: [{ value: UNASSIGNED, label: t('trips.create.unassigned') }, ...drivers] }
}

/**
 * Sửa chuyến bản máy chủ (`PATCH /api/trips/{id}`): tên, ngày và giờ xuất phát (giờ Việt Nam), xe, tài xế, kho xuất phát. Chỉ chuyến Nháp
 * và Đã lập kế hoạch (máy chủ từ chối `TRIP_NOT_EDITABLE`); xe không chở được hàng là `VEHICLE_CANNOT_CARRY_CARGO`. Lỗi hiện trong hộp
 * thoại, dữ liệu đang nhập giữ nguyên.
 */
export function BackendTripEditDialog({ trip, open, onOpenChange }: {
  trip: TripDetailApiResponse
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const update = useUpdateBackendTripMutation(String(trip.id))
  const options = useTripFormOptionsQuery()
  const warehouses = useCompanyWarehousesQuery(true)
  const initial = useMemo(() => defaultsOf(trip), [trip])
  const schema = useMemo(() => editSchema(t), [t])
  const form = useForm<EditValues>({ resolver: zodResolver(schema), defaultValues: initial })
  const choices = useMemo(() => choicesOf(options.data, initial, t), [options.data, initial, t])
  const warehouseOptions = useMemo<SelectOption[]>(() => [
    { value: KEEP_WAREHOUSE, label: t('serverPlans.edit.keepWarehouse', { name: trip.originName }) },
    ...(warehouses.data ?? [])
      .filter((item) => item.latitude !== null && item.longitude !== null)
      .map((item) => ({ value: String(item.id), label: item.warehouseName })),
  ], [warehouses.data, trip.originName, t])

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(initial)
      update.reset()
    }
    onOpenChange(next)
  }

  function handleSubmit(values: EditValues) {
    const changes = tripChangesOf(initial, values)
    if (changes === null) {
      form.setError('root', { message: t('serverPlans.edit.noChanges') })
      return
    }
    update.mutate(changes, {
      onSuccess: () => {
        toast.success(t('serverPlans.edit.saved', { code: trip.tripCode }))
        handleOpenChange(false)
      },
    })
  }

  const errors = form.formState.errors
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-140">
        <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader icon={Pencil} title={t('serverPlans.edit.title', { code: trip.tripCode })} description={t('serverPlans.edit.description')} />
          <div className="grid gap-4 px-7 py-5 sm:grid-cols-2">
            <Input className="sm:col-span-2" label={t('serverPlans.edit.name')} required error={errors.name?.message} {...form.register('name')} />
            <Input type="date" label={t('serverPlans.edit.date')} required error={errors.date?.message} {...form.register('date')} />
            <Input type="time" label={t('serverPlans.edit.time')} required error={errors.time?.message} {...form.register('time')} />
            <SelectField control={form.control} name="vehicleId" label={t('serverPlans.edit.vehicle')} options={choices.vehicles} required />
            <SelectField control={form.control} name="driverId" label={t('serverPlans.edit.driver')} options={choices.drivers} />
            <SelectField className="sm:col-span-2" control={form.control} name="warehouseId" label={t('serverPlans.edit.warehouse')} options={warehouseOptions} />
            {errors.root?.message ? <p role="status" className="text-caption text-ink-2 sm:col-span-2">{errors.root.message}</p> : null}
            {update.isError ? <p role="alert" className="text-caption text-danger sm:col-span-2">{dataErrorMessage(update.error, t)}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>{t('serverPlans.edit.cancel')}</Button>
            <Button type="submit" loading={update.isPending}>{t('serverPlans.edit.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
