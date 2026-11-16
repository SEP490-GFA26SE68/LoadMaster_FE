import { ChevronLeft, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { MaintenanceDialog } from './MaintenanceDialog'
import { useVehicleMaintenanceMutation, useVehicleQuery, useVehicleStateQuery } from './useVehiclesQuery'
import type { FleetVehicle, FleetVehicleState } from './vehicle-status'
import { VehicleForm } from './VehicleForm'
import { VehicleStateBanner } from './VehicleStateBanner'
import { VehicleStatusBadge } from './VehicleStatusBadge'
import { VehicleDetailPage as BackendVehicleDetailPage } from './backend/VehicleDetailPage'
import { usesBackend } from '@/lib/backend-config'

/**
 * Trang cấu hình xe (D-17, D-38): `/doi-xe/moi` thêm xe mới, `/doi-xe/:vehicleId` sửa xe đang có.
 * Trạng thái xe (LM-089, D-53): xe đang chạy chuyến thì form chỉ đọc kèm thông báo chuyến nào; người có quyền sửa đội xe bật/tắt
 * bảo dưỡng bằng nút phụ trên thanh tiêu đề.
 */
function StoreVehicleDetailPage() {
  const { vehicleId } = useParams()
  if (vehicleId === undefined) return <VehicleForm />
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

function ExistingVehicle({ vehicle, state }: { vehicle: FleetVehicle; state: FleetVehicleState | null }) {
  const t = useT()
  const canEdit = useCan()('fleet.edit')
  const maintenance = useVehicleMaintenanceMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const running = state?.status === 'in_use'

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

  const notice = state && state.status !== 'available' ? <VehicleStateBanner state={state} /> : null

  return (
    <>
      <VehicleForm
        vehicle={vehicle}
        readOnly={!canEdit || running}
        status={state ? <VehicleStatusBadge status={state.status} /> : null}
        actions={action}
        notice={notice}
      />
      {/* Ngoài form xe trong cây React: submit của hộp thoại không được lan tới nút Lưu (xem MaintenanceDialog). */}
      <MaintenanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicleName={vehicle.name}
        pending={maintenance.isPending}
        onSubmit={handleMaintenance}
      />
    </>
  )
}

/** Nhóm `fleet` nối backend thì màn là bản của nhóm phát triển (`./backend`), đọc ghi máy chủ; không thì là kho mẫu. */
export function VehicleDetailPage() {
  return usesBackend('fleet') ? <BackendVehicleDetailPage /> : <StoreVehicleDetailPage />
}
