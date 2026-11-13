import { Pencil, Trash2, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'

import { MaintenanceDialog } from '../MaintenanceDialog'
import { useDeleteVehicleMutation, useVehicleMaintenanceMutation } from './useVehiclesQuery'
import type { Vehicle } from './vehicles-api'

/**
 * Sửa, bảo dưỡng, xoá xe (theo `fleet.edit`). Xe ngừng sử dụng chỉ xem. Xe đang chạy chuyến không vào bảo dưỡng và không xoá được
 * (máy chủ từ chối `VEHICLE_BUSY` / `VEHICLE_IN_USE`) nên hai nút đó không hiện; dòng thông báo trạng thái nói chuyến nào đang dùng xe.
 */
export function VehicleActions({ vehicle, onEdit }: { vehicle: Vehicle; onEdit: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const canEdit = useCan()('fleet.edit')
  const maintenance = useVehicleMaintenanceMutation()
  const remove = useDeleteVehicleMutation()
  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!canEdit || vehicle.status === 'RETIRED') return null
  const running = vehicle.status === 'IN_TRIP'

  function handleMaintenance(note: string | null) {
    maintenance.mutate({ id: vehicle.id, note }, {
      onSuccess: () => {
        setMaintenanceOpen(false)
        toast.success(t(note === null ? 'fleet.maintenance.ended' : 'fleet.maintenance.started', { name: vehicle.name }))
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  function handleDelete() {
    remove.mutate(vehicle.id, {
      onSuccess: (outcome) => {
        setConfirmDelete(false)
        toast.success(t(outcome === 'RETIRED' ? 'fleet.detail.retiredInstead' : 'fleet.detail.deleted', { name: vehicle.name }))
        void navigate('/doi-xe', { replace: true })
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" onClick={onEdit}>
        <Pencil strokeWidth={1.5} />
        {t('fleet.detail.edit')}
      </Button>
      {running ? null : vehicle.status === 'MAINTENANCE' ? (
        <Button type="button" variant="secondary" loading={maintenance.isPending} onClick={() => handleMaintenance(null)}>
          <Wrench strokeWidth={1.5} />
          {t('fleet.maintenance.end')}
        </Button>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setMaintenanceOpen(true)}>
          <Wrench strokeWidth={1.5} />
          {t('fleet.maintenance.start')}
        </Button>
      )}
      {running ? null : (
        <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
          <Trash2 strokeWidth={1.5} />
          {t('fleet.detail.delete')}
        </Button>
      )}
      <MaintenanceDialog
        open={maintenanceOpen}
        onOpenChange={setMaintenanceOpen}
        vehicleName={vehicle.name}
        pending={maintenance.isPending}
        onSubmit={handleMaintenance}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('fleet.remove.title', { name: vehicle.name })}
        description={t('fleet.remove.description')}
        cancelLabel={t('fleet.remove.cancel')}
        confirmLabel={t('fleet.remove.confirm')}
        danger
        pending={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
