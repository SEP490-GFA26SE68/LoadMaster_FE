import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useCompanyWarehousesQuery } from '@/features/company-warehouses/useCompanyWarehousesQuery'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { createTripFormSchema, departureAtOf, depotFormValues, driverIdOf, tripFormDefaults, type TripFormValues } from './trip-form.schema'
import { tripFormChoices } from './trip-form-choices'
import { TripFormAside } from './TripFormAside'
import { TripFormCargoSection } from './TripFormCargoSection'
import { BackendTripFormDepotSection } from './BackendTripFormDepotSection'
import { TripFormInfoSection } from './TripFormInfoSection'
import { TripFormLeaveDialog } from './TripFormLeaveDialog'
import { TripFormShell } from './TripFormShell'
import { useCreateBackendTripMutation, useTripFormOptionsQuery } from './useTripsQuery'

/**
 * Tạo chuyến khi nhóm `trips` nối backend (`/chuyen/moi`, `POST /api/trips`; V2.3 TaoChuyen.jpg): tên, ngày và giờ xuất phát, tài xế,
 * xe, kho xuất phát chọn trong danh sách kho của công ty (`GET /api/company-warehouses`, mặc định kho mặc định của công ty); xe bảo dưỡng
 * không chọn được (D-53). Tạo chuyến **không nhập điểm giao**: điểm tự sinh khi đưa yêu cầu giao vào chuyến (D-73). Nút chính nằm trên
 * dải trời, gửi form qua thuộc tính `form`. Còn thay đổi chưa lưu mà rời trang thì hỏi lại trước (LM-100). Sửa chuyến của máy chủ là
 * `BackendTripEditPage`.
 */
export function BackendTripFormPage() {
  const t = useT()
  const formId = useId()
  const navigate = useNavigate()
  const options = useTripFormOptionsQuery()
  const warehousesQuery = useCompanyWarehousesQuery(true)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')

  const create = useCreateBackendTripMutation()
  const schema = useMemo(() => createTripFormSchema(t), [t])
  // Lỗi hiện dưới ô ngay khi rời ô (không đợi bấm lưu), cùng lúc với thẻ kiểm tra bên phải
  const form = useForm<TripFormValues>({ resolver: zodResolver(schema), defaultValues: tripFormDefaults(), mode: 'onTouched' })
  const vehicleId = useWatch({ control: form.control, name: 'vehicleId' })
  const choices = useMemo(() => tripFormChoices(options.data, undefined, t), [options.data, t])
  const selected = options.data?.vehicles.find((option) => option.vehicle.id === vehicleId)
  const { isDirty } = form.formState
  // Lưu xong: rời trang trong effect ở lần render sau, để hộp hỏi "rời trang?" không chặn chính mình (như form xe, LM-041)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && savedPath === null && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (savedPath !== null) void navigate(savedPath)
  }, [savedPath, navigate])

  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data])

  const applyWarehouse = useCallback((warehouseId: string) => {
    const warehouse = warehouses.find((item) => String(item.id) === warehouseId)
    if (!warehouse || warehouse.latitude === null || warehouse.longitude === null) return
    form.setValue(
      'depot',
      depotFormValues({ name: warehouse.warehouseName, address: warehouse.address, lat: warehouse.latitude, lng: warehouse.longitude }),
      { shouldDirty: false, shouldValidate: true },
    )
    setSelectedWarehouseId(warehouseId)
  }, [warehouses, form])

  // Kho mặc định đang hoạt động của công ty là kho xuất phát ban đầu
  useEffect(() => {
    if (selectedWarehouseId !== '' || warehousesQuery.isPending) return
    const defaultWarehouse = warehouses.find((warehouse) =>
      warehouse.isDefault && warehouse.isActive && warehouse.latitude !== null && warehouse.longitude !== null)
    if (defaultWarehouse) applyWarehouse(String(defaultWarehouse.id))
  }, [selectedWarehouseId, warehousesQuery.isPending, warehouses, applyWarehouse])

  function handleSubmit(values: TripFormValues) {
    if (!selectedWarehouseId) {
      toast.error(t('tripWarehouse.placeholder'))
      return
    }
    create.mutate({
      name: values.name,
      vehicleId: values.vehicleId,
      departureAt: departureAtOf(values),
      originWarehouseId: selectedWarehouseId,
      driverId: driverIdOf(values.driverId),
    }, {
      onSuccess: (trip) => {
        toast.success(t('trips.create.created', { id: trip.id }))
        setSavedPath(`/chuyen/${trip.id}`)
      },
      onError: (error) => toast.error(t('trips.create.failed'), { description: dataErrorMessage(error, t) }),
    })
  }

  const actions = (
    <>
      <Button variant="skyGhost" asChild>
        <Link to="/chuyen">{t('trips.create.cancel')}</Link>
      </Button>
      <Button type="submit" form={formId} variant="primary" loading={create.isPending}>
        {create.isPending ? null : <Save strokeWidth={1.75} />}
        {t('trips.create.submitCreate')}
      </Button>
    </>
  )

  return (
    <TripFormShell actions={actions}>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_416px]">
        <Card className="min-w-0 overflow-hidden">
          <form id={formId} noValidate onSubmit={form.handleSubmit(handleSubmit)}>
            <TripFormInfoSection form={form} vehicles={choices.vehicles} drivers={choices.drivers} selected={selected} locked={false} />
            <BackendTripFormDepotSection
              form={form}
              locked={false}
              warehouses={warehouses}
              loading={warehousesQuery.isPending}
              selectedWarehouseId={selectedWarehouseId}
              onWarehouseChange={applyWarehouse}
            />
            <TripFormCargoSection existing={undefined} locked={false} />
          </form>
        </Card>
        <TripFormAside form={form} schema={schema} selected={selected} existing={undefined} locked={false} />
      </div>
      <TripFormLeaveDialog open={blocker.state === 'blocked'} onStay={() => blocker.reset?.()} onLeave={() => blocker.proceed?.()} />
    </TripFormShell>
  )
}
