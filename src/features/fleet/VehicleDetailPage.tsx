import { ChevronLeft, Info, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { FleetUnavailable } from './FleetUnavailable'
import { MaintenanceDialog } from './MaintenanceDialog'
import { fleetReachable, useFleetCapabilities, useVehicleMaintenanceMutation, useVehicleQuery, useVehicleStateQuery } from './useVehiclesQuery'
import type { FleetVehicle, FleetVehicleState } from './vehicle-status'
import { VehicleForm } from './VehicleForm'
import { VehicleStateBanner } from './VehicleStateBanner'
import { VehicleStatusBadge } from './VehicleStatusBadge'

/**
 * Trang cấu hình xe (D-17, D-38): `/doi-xe/moi` thêm xe mới, `/doi-xe/:vehicleId` sửa xe đang có.
 * Trạng thái xe (LM-089, D-53): xe đang chạy chuyến thì form chỉ đọc kèm thông báo chuyến nào; người có quyền sửa đội xe bật/tắt
 * bảo dưỡng bằng nút phụ trên thanh tiêu đề. Nối backend (`FLEET_CAPABILITIES`): chỉ xem, không có trang thêm xe; chỉ điều phối viên đọc
 * được xe — người khác thấy một dòng lý do và màn không gọi backend.
 */
export function VehicleDetailPage() {
  const t = useT()
  const can = useCan()
  const caps = useFleetCapabilities()
  const { vehicleId } = useParams()
  const back = { to: '/doi-xe', label: t('fleet.detail.back') }

  if (!fleetReachable(can)) return <FleetUnavailable title={t('fleet.title')} back={back} reason={t('fleet.backend.dispatcherOnly')} />
  if (vehicleId === undefined) {
    return caps.write ? <VehicleForm /> : <FleetUnavailable title={t('fleet.detail.newTitle')} back={back} reason={t('fleet.backend.noCreate')} />
  }
  return <VehicleDetail vehicleId={vehicleId} />
}

function VehicleDetail({ vehicleId }: { vehicleId: string }) {
  const t = useT()
  const query = useVehicleQuery(vehicleId)
  const stateQuery = useVehicleStateQuery(vehicleId)

  // Chờ cả trạng thái: form của xe đang chạy chuyến không được hiện ô nhập mở rồi mới khoá.
  if (query.isPending || stateQuery.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-8" role="status" aria-label={t('fleet.detail.loading')}>
        <Spinner />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-body text-text-2">{t('fleet.detail.notFound', { id: vehicleId })}</p>
        <Button variant="secondary" asChild>
          <Link to="/doi-xe">
            <ChevronLeft strokeWidth={1.5} />
            {t('fleet.detail.back')}
          </Link>
        </Button>
      </div>
    )
  }

  // `key` để form nạp lại giá trị mặc định khi chuyển sang xe khác
  return <ExistingVehicle key={query.data.id} vehicle={query.data} state={stateQuery.data ?? null} />
}

/** Trục từ backend chưa có tên (backend chỉ có trục trước và trục sau): đặt tên theo ngôn ngữ đang chọn. */
const BACKEND_AXLE_IDS = ['front', 'rear'] as const

function ExistingVehicle({ vehicle, state }: { vehicle: FleetVehicle; state: FleetVehicleState | null }) {
  const t = useT()
  const caps = useFleetCapabilities()
  const canEdit = useCan()('fleet.edit') && caps.write
  const maintenance = useVehicleMaintenanceMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const running = state?.status === 'in_use'
  const shown = useMemo(() => (caps.write ? vehicle : {
    ...vehicle,
    ...(vehicle.axles ? {
      axles: vehicle.axles.map((axle) => {
        const id = BACKEND_AXLE_IDS.find((key) => key === axle.id)
        return axle.name === '' && id ? { ...axle, name: t(`fleet.backend.axleNames.${id}`) } : axle
      }),
    } : {}),
  }), [caps.write, vehicle, t])

  function handleMaintenance(note: string | null) {
    maintenance.mutate({ id: vehicle.id, note }, {
      onSuccess: () => {
        setDialogOpen(false)
        toast.success(t(note === null ? 'fleet.maintenance.ended' : 'fleet.maintenance.started', { name: vehicle.name }))
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  const action = !canEdit || !state || running || state.status === 'retired' ? null : state.status === 'maintenance' ? (
    <Button type="button" variant="glass" loading={maintenance.isPending} onClick={() => handleMaintenance(null)}>
      <Wrench strokeWidth={1.5} />
      {t('fleet.maintenance.end')}
    </Button>
  ) : (
    <Button type="button" variant="glass" onClick={() => setDialogOpen(true)}>
      <Wrench strokeWidth={1.5} />
      {t('fleet.maintenance.start')}
    </Button>
  )

  const stateNotice = state && state.status !== 'available' ? <VehicleStateBanner state={state} /> : null
  const notice = caps.write ? stateNotice : (
    <div className="flex flex-col gap-3">
      <Banner tone="info" icon={Info}>
        <p>{t('fleet.backend.readOnly')}</p>
        {vehicle.doorUnknown ? <p className="mt-1">{t('fleet.backend.doorUnknown')}</p> : null}
        {vehicle.axles ? null : <p className="mt-1">{t('fleet.backend.axlesUnknown')}</p>}
      </Banner>
      {stateNotice}
    </div>
  )

  return (
    <>
      <VehicleForm
        vehicle={shown}
        readOnly={!canEdit || running}
        status={state ? <VehicleStatusBadge status={state.status} /> : null}
        actions={action}
        notice={notice}
      />
      {/* Ngoài form xe trong cây React: submit của hộp thoại không được lan tới nút Lưu (xem MaintenanceDialog). */}
      {caps.write ? (
        <MaintenanceDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          vehicleName={vehicle.name}
          pending={maintenance.isPending}
          onSubmit={handleMaintenance}
        />
      ) : null}
    </>
  )
}
