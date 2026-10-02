import { zodResolver } from '@hookform/resolvers/zod'
import { Lock, Save } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Trip, TripPhase } from '@/lib/mock-db'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { TripStatus, TripSubStatus } from '@/types/trip'
import { createTripFormSchema, departureAtOf, depotFormValues, depotOf, driverIdOf, tripFormDefaults, type TripFormValues } from './trip-form.schema'
import { tripFormChoices } from './trip-form-choices'
import { TripFormAside } from './TripFormAside'
import { TripFormCargoSection } from './TripFormCargoSection'
import { TripFormDepotSection } from './TripFormDepotSection'
import { TripFormInfoSection } from './TripFormInfoSection'
import { TripFormLeaveDialog } from './TripFormLeaveDialog'
import { TripFormLockedStops } from './TripFormLockedStops'
import { TripFormSection } from './TripFormSection'
import { TripFormShell } from './TripFormShell'
import { TripStopsFields } from './TripStopsFields'
import { useCreateTripMutation, useTripDetailQuery, useTripFormOptionsQuery, useUpdateTripFrameMutation } from './useTripsQuery'

/** Pha còn mở form sửa: lập kế hoạch sửa mọi thứ; kho đang/đã xếp chỉ còn tên, ngày giờ xuất phát, tài xế (D-45). */
const EDITABLE_PHASES: readonly TripPhase[] = ['planning', 'loading', 'loaded']

/**
 * Tạo mới hoặc sửa khung chuyến (LM-053, LM-088, V2.3 TaoChuyen.jpg / SuaChuyenKhoa.jpg; FE-4b-04): ghi thật vào kho qua mutation,
 * không báo thành công giả. Tên, ngày và giờ xuất phát, tài xế, xe, kho xuất phát; xe bảo dưỡng không chọn được (D-53). Tạo chuyến
 * **không nhập điểm giao**: điểm tự sinh khi đưa yêu cầu giao vào chuyến, điểm tay và kiện thêm ở Chi tiết chuyến (D-73); form sửa chỉ
 * đổi chữ của điểm giao đang có. Nút chính nằm trên dải trời, gửi form qua thuộc tính `form`. Còn thay đổi chưa lưu mà rời trang thì
 * hỏi lại trước (LM-100).
 */
export function TripFormPage() {
  const { tripId = '' } = useParams()
  const t = useT()
  const detail = useTripDetailQuery(tripId)
  if (tripId === '') return <TripForm />
  if (detail.isPending) return <TripFormShell trip={{ id: tripId, data: null }} />
  if (!detail.data) {
    return (
      <TripFormShell trip={{ id: tripId, data: null }}>
        <Card className="p-6">
          <p role="alert" className="text-body text-danger">{t('trips.create.notFound', { id: tripId })}</p>
        </Card>
      </TripFormShell>
    )
  }
  const { trip, status, sub } = detail.data
  if (!EDITABLE_PHASES.includes(trip.phase)) {
    return (
      <TripFormShell trip={{ id: tripId, data: trip }} status={status} sub={sub}>
        <Card className="flex flex-col items-start gap-3 p-6">
          <p role="alert" className="text-body text-text-2">{t('trips.create.notEditable', { id: tripId })}</p>
          <Button variant="secondary" asChild><Link to={`/chuyen/${tripId}`}>{t('trips.create.back')}</Link></Button>
        </Card>
      </TripFormShell>
    )
  }
  return <TripForm key={trip.id} existing={trip} status={status} sub={sub} />
}

function TripForm({ existing, status, sub }: { existing?: Trip; status?: TripStatus; sub?: TripSubStatus | null }) {
  const t = useT()
  const formId = useId()
  const navigate = useNavigate()
  const options = useTripFormOptionsQuery()
  const create = useCreateTripMutation()
  const update = useUpdateTripFrameMutation(existing?.id ?? '')
  const schema = useMemo(() => createTripFormSchema(t), [t])
  // Lỗi hiện dưới ô ngay khi rời ô (không đợi bấm lưu), cùng lúc với thẻ kiểm tra bên phải
  const form = useForm<TripFormValues>({ resolver: zodResolver(schema), defaultValues: tripFormDefaults(existing), mode: 'onTouched' })
  const vehicleId = useWatch({ control: form.control, name: 'vehicleId' })
  const choices = useMemo(() => tripFormChoices(options.data, existing, t), [options.data, existing, t])
  const selected = options.data?.vehicles.find((option) => option.vehicle.id === vehicleId)
  // Kho đã bắt đầu xếp: xe, kho đi và điểm giao khoá, còn tên, ngày giờ xuất phát, tài xế (D-45)
  const locked = existing !== undefined && existing.phase !== 'planning'
  const { isDirty } = form.formState
  const backTo = existing ? `/chuyen/${existing.id}` : '/chuyen'
  const pending = create.isPending || update.isPending
  // Lưu xong: rời trang trong effect ở lần render sau, để hộp hỏi "rời trang?" không chặn chính mình (như form xe, LM-041)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && savedPath === null && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (savedPath !== null) void navigate(savedPath)
  }, [savedPath, navigate])

  // Chuyến mới xuất phát từ kho của công ty (D-76): điền khi kho tải xong, trừ khi người dùng đã tự nhập kho đi
  const companyDepot = options.data?.depot
  useEffect(() => {
    if (existing || !companyDepot || form.getFieldState('depot').isDirty) return
    form.resetField('depot', { defaultValue: depotFormValues(companyDepot) })
  }, [existing, companyDepot, form])

  function handleSubmit(values: TripFormValues) {
    const onError = (error: unknown) => toast.error(t('trips.create.failed'), { description: dataErrorMessage(error, t) })
    const driverId = driverIdOf(values.driverId)
    const departureAt = departureAtOf(values)
    const onSuccess = (trip: Trip, message: string) => {
      toast.success(message)
      setSavedPath(`/chuyen/${trip.id}`)
    }
    if (existing) {
      const frame = { name: values.name, departureAt, driverId }
      update.mutate(locked ? frame : { ...frame, vehicleId: values.vehicleId, depot: depotOf(values.depot), stops: values.stops }, {
        onSuccess: (trip) => onSuccess(trip, t('trips.create.saved', { id: trip.id })),
        onError,
      })
      return
    }
    create.mutate({ name: values.name, vehicleId: values.vehicleId, departureAt, depot: depotOf(values.depot), driverId }, {
      onSuccess: (trip) => onSuccess(trip, t('trips.create.created', { id: trip.id })),
      onError,
    })
  }

  const actions = (
    <>
      <Button variant="skyGhost" asChild>
        <Link to={backTo}>{t('trips.create.cancel')}</Link>
      </Button>
      <Button type="submit" form={formId} variant="primary" loading={pending}>
        {pending ? null : <Save strokeWidth={1.75} />}
        {existing ? t('trips.create.submitEdit') : t('trips.create.submitCreate')}
      </Button>
    </>
  )

  return (
    <TripFormShell trip={existing ? { id: existing.id, data: existing } : undefined} status={status} sub={sub} actions={actions}>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_416px]">
        <Card className="min-w-0 overflow-hidden">
          <form id={formId} noValidate onSubmit={form.handleSubmit(handleSubmit)}>
            {locked ? (
              <Banner tone="info" icon={Lock} className="mx-7 mt-5.5 max-sm:mx-4">{t('trips.create.lockedHint')}</Banner>
            ) : null}
            <TripFormInfoSection form={form} vehicles={choices.vehicles} drivers={choices.drivers} selected={selected} locked={locked} />
            <TripFormDepotSection form={form} locked={locked} />
            {existing ? (
              <TripFormSection
                number={3}
                title={t('trips.create.stopsTitle')}
                meta={t('trips.create.stopCount', { count: existing.stops.length })}
                locked={locked}
                description={locked ? undefined : t('trips.create.editStopsHint')}
              >
                {locked ? <TripFormLockedStops stops={existing.stops} /> : <TripStopsFields form={form} saved={existing.stops} />}
              </TripFormSection>
            ) : null}
            <TripFormCargoSection existing={existing} locked={locked} />
          </form>
        </Card>
        <TripFormAside form={form} schema={schema} selected={selected} existing={existing} locked={locked} />
      </div>
      <TripFormLeaveDialog open={blocker.state === 'blocked'} onStay={() => blocker.reset?.()} onLeave={() => blocker.proceed?.()} />
    </TripFormShell>
  )
}
