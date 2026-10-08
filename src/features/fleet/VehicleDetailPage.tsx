import { ChevronLeft, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import type { VehicleConfig } from '@/domain/models'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { VehicleState } from '@/lib/mock-db'
import { MaintenanceDialog } from './MaintenanceDialog'
import { useVehicleMaintenanceMutation, useVehicleQuery, useVehicleStateQuery } from './useVehiclesQuery'
import { VehicleForm } from './VehicleForm'
import { VehicleStateBanner } from './VehicleStateBanner'
import { VehicleStatusBadge } from './VehicleStatusBadge'

/**
 * Trang cấu hình xe (D-17, D-38): `/doi-xe/moi` thêm xe mới, `/doi-xe/:vehicleId` sửa xe đang có.
 * Trạng thái xe (LM-089, D-53): xe đang chạy chuyến thì form chỉ đọc kèm thông báo chuyến nào; người có quyền sửa đội xe bật/tắt
 * bảo dưỡng bằng nút phụ trên thanh tiêu đề.
 */
export function VehicleDetailPage() {
  const t = useT()
  const { vehicleId } = useParams()
  const query = useVehicleQuery(vehicleId ?? '')
  const stateQuery = useVehicleStateQuery(vehicleId ?? '')

  if (vehicleId === undefined) return <VehicleForm />

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

function ExistingVehicle({ vehicle, state }: { vehicle: VehicleConfig; state: VehicleState | null }) {
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

  const action = !canEdit || !state || running ? null : state.status === 'maintenance' ? (
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

  return (
    <>
      <VehicleForm
        vehicle={vehicle}
        readOnly={!canEdit || running}
        status={state ? <VehicleStatusBadge status={state.status} /> : null}
        actions={action}
        notice={state && state.status !== 'available' ? <VehicleStateBanner state={state} /> : null}
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
