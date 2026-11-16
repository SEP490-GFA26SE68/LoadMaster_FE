import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useCompanyWarehousesQuery } from '@/features/company-warehouses/useCompanyWarehousesQuery'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { TripStatus } from '@/types/trip'
import { backendTripChanges, backendTripEditSchema, backendTripFormDefaults, isBackendTripEditable } from './backend-trip-edit'
import { BackendTripFormDepotSection } from './BackendTripFormDepotSection'
import { depotFormValues, driverIdOf, type TripFormValues } from './trip-form.schema'
import { tripFormChoices } from './trip-form-choices'
import { useRunDateText } from './trip-form-dates'
import { TripFormInfoSection } from './TripFormInfoSection'
import { TripFormLeaveDialog } from './TripFormLeaveDialog'
import { TripFormShell } from './TripFormShell'
import type { TripDetailApiResponse } from './trips-api'
import { useBackendTripDetailQuery, useBackendTripIdQuery, useUpdateBackendTripMutation } from './useTripEditBackendQuery'
import { useTripFormOptionsQuery } from './useTripsQuery'

/**
 * Sửa chuyến khi nhóm `trips` nối backend (`/chuyen/:id/sua`, `PATCH /api/trips/{id}`): tên, ngày và giờ xuất phát (giờ Việt Nam), xe,
 * tài xế, kho xuất phát — chỉ gửi trường đã đổi (`backendTripChanges`). Máy chủ chỉ sửa chuyến Nháp và Đã lập kế hoạch, và sửa được mọi
 * trường ở hai trạng thái đó; trạng thái khác thấy một dòng lý do, không có form. Máy chủ không trả mã kho của chuyến: ô kho mặc định
 * "Giữ kho hiện tại", chọn kho khác mới gửi. Điểm giao và kiện không sửa ở đây (điểm giao sinh từ yêu cầu giao). Lỗi của máy chủ (xe
 * không chở được hàng…) hiện bằng toast, dữ liệu đang nhập giữ nguyên; còn thay đổi chưa lưu mà rời trang thì hỏi lại.
 */
export function BackendTripEditPage() {
  const { tripId = '' } = useParams()
  const t = useT()
  const resolved = useBackendTripIdQuery(tripId)
  const detail = useBackendTripDetailQuery(resolved.data ?? '')
  const error = resolved.error ?? detail.error
  if (error) return <Unavailable tripId={tripId} message={dataErrorMessage(error, t)} backTo="/chuyen" backLabel={t('common.backToTrips')} />
  if (!detail.data) return <TripFormShell trip={{ id: tripId, data: null }} />
  const { trip } = detail.data
  if (!isBackendTripEditable(trip.status)) {
    return (
      <Unavailable
        tripId={trip.tripCode}
        status={trip.status}
        message={t('serverPlans.edit.notEditable', { id: trip.tripCode })}
        backTo={`/chuyen/${encodeURIComponent(trip.tripCode)}`}
        backLabel={t('trips.create.back')}
      />
    )
  }
  return <EditForm key={trip.id} trip={trip} />
}

function Unavailable({ tripId, status, message, backTo, backLabel }: {
  tripId: string
  status?: TripStatus
  message: string
  backTo: string
  backLabel: string
}) {
  return (
    <TripFormShell trip={{ id: tripId, data: null }} status={status}>
      <Card className="flex flex-col items-start gap-3 p-6">
        <p role="alert" className="text-body text-text-2">{message}</p>
        <Button variant="secondary" asChild><Link to={backTo}>{backLabel}</Link></Button>
      </Card>
    </TripFormShell>
  )
}

function EditForm({ trip }: { trip: TripDetailApiResponse }) {
  const t = useT()
  const formId = useId()
  const navigate = useNavigate()
  const runDate = useRunDateText()
  const options = useTripFormOptionsQuery()
  const warehousesQuery = useCompanyWarehousesQuery(true)
  const update = useUpdateBackendTripMutation(String(trip.id))
  const schema = useMemo(() => backendTripEditSchema(t), [t])
  const [initial] = useState(() => backendTripFormDefaults(trip))
  const form = useForm<TripFormValues>({ resolver: zodResolver(schema), defaultValues: initial, mode: 'onTouched' })
  // Rỗng: giữ kho hiện tại
  const [warehouseId, setWarehouseId] = useState('')
  const [unchanged, setUnchanged] = useState(false)
  const [saved, setSaved] = useState(false)
  const vehicleId = useWatch({ control: form.control, name: 'vehicleId' })
  const current = useMemo(() => ({ vehicleId: initial.vehicleId, driverId: driverIdOf(initial.driverId) }), [initial])
  const choices = useMemo(() => tripFormChoices(options.data, current, t), [options.data, current, t])
  const selected = options.data?.vehicles.find((option) => option.vehicle.id === vehicleId)
  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data])
  const detailPath = `/chuyen/${encodeURIComponent(trip.tripCode)}`
  const dirty = form.formState.isDirty || warehouseId !== ''
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saved && currentLocation.pathname !== nextLocation.pathname)

  // Lưu xong: rời trang ở lần render sau, để hộp hỏi "rời trang?" không chặn chính mình (như form tạo chuyến)
  useEffect(() => {
    if (saved) void navigate(detailPath)
  }, [saved, navigate, detailPath])

  function handleWarehouseChange(id: string) {
    if (id === '') {
      form.setValue('depot', initial.depot)
      setWarehouseId('')
      return
    }
    const warehouse = warehouses.find((item) => String(item.id) === id)
    if (!warehouse || warehouse.latitude === null || warehouse.longitude === null) return
    form.setValue('depot', depotFormValues({ name: warehouse.warehouseName, address: warehouse.address, lat: warehouse.latitude, lng: warehouse.longitude }))
    setWarehouseId(id)
  }

  function handleSubmit(values: TripFormValues) {
    const changes = backendTripChanges(initial, values, warehouseId)
    setUnchanged(changes === null)
    if (changes === null) return
    update.mutate(changes, {
      onSuccess: () => {
        toast.success(t('serverPlans.edit.saved', { code: trip.tripCode }))
        setSaved(true)
      },
      onError: (error) => toast.error(t('trips.create.failed'), { description: dataErrorMessage(error, t) }),
    })
  }

  const actions = (
    <>
      <Button variant="skyGhost" asChild>
        <Link to={detailPath}>{t('trips.create.cancel')}</Link>
      </Button>
      <Button type="submit" form={formId} variant="primary" loading={update.isPending}>
        {update.isPending ? null : <Save strokeWidth={1.75} />}
        {t('trips.create.submitEdit')}
      </Button>
    </>
  )
  const subline = [trip.tripName, runDate.withDay(initial.scheduledDate, { relative: true })].filter(Boolean).join('  ·  ')

  return (
    <TripFormShell trip={{ id: trip.tripCode, data: null }} status={trip.status} subline={subline} actions={actions}>
      <Card className="min-w-0 max-w-5xl overflow-hidden">
        <form id={formId} noValidate onSubmit={form.handleSubmit(handleSubmit)}>
          <Banner tone="info" className="mx-7 mt-5.5 max-sm:mx-4">{t('serverPlans.edit.description')}</Banner>
          {unchanged ? <Banner tone="neutral" className="mx-7 mt-3 max-sm:mx-4">{t('serverPlans.edit.noChanges')}</Banner> : null}
          <TripFormInfoSection form={form} vehicles={choices.vehicles} drivers={choices.drivers} selected={selected} locked={false} />
          <BackendTripFormDepotSection
            form={form}
            locked={false}
            warehouses={warehouses}
            loading={warehousesQuery.isPending}
            selectedWarehouseId={warehouseId}
            onWarehouseChange={handleWarehouseChange}
            placeholder={t('serverPlans.edit.keepWarehouse', { name: trip.originName })}
          />
        </form>
      </Card>
      <TripFormLeaveDialog open={blocker.state === 'blocked'} onStay={() => blocker.reset?.()} onLeave={() => blocker.proceed?.()} />
    </TripFormShell>
  )
}
