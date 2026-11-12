import { Ban, Pencil, Truck, Unlink } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { BackendCancelTripDialog } from './BackendCancelTripDialog'
import { isBackendTripEditable } from './backend-trip-edit'
import { ChangeVehicleDialog } from './ChangeVehicleDialog'
import type { TripDetailApiResponse } from './trips-api'
import { useRemoveBackendRequirementMutation } from './useTripEditBackendQuery'

type Status = TripDetailApiResponse['status']

/**
 * Máy chủ chỉ sửa chuyến Nháp / Đã lập kế hoạch (`TRIP_NOT_EDITABLE`), huỷ thêm được chuyến Đang xếp hàng và Đang vận chuyển — chuyến
 * đang chạy chỉ khi có sự cố chưa xử lý, hộp huỷ tự xét (`TRIP_NOT_CANCELLABLE`, `TRIP_CANCEL_NEEDS_OPEN_EXCEPTION`).
 */
export const isEditableStatus = isBackendTripEditable
export const isCancellableStatus = (status: Status) => isEditableStatus(status) || status === 'LOADING' || status === 'IN_TRANSIT'

/**
 * Nút phụ của Chi tiết chuyến bản máy chủ; nơi gọi đã xét quyền `trips.edit`. "Sửa chuyến" mở form sửa (`/chuyen/:mã/sua`); chuyến Đã
 * lập kế hoạch có thêm "Đổi xe" — hộp thoại liệt kê xe kèm lý do chọn được hay không (`GET /api/trips/{id}/vehicle-choices`), như ở
 * Planner; chuyến Nháp đổi xe ở form sửa. "Huỷ chuyến" hỏi lý do.
 */
export function BackendTripWriteActions({ trip }: { trip: TripDetailApiResponse }) {
  const t = useT()
  const [changingVehicle, setChangingVehicle] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const vehicleRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      {isEditableStatus(trip.status) ? (
        <Button variant="secondary" asChild>
          <Link to={`/chuyen/${encodeURIComponent(trip.tripCode)}/sua`}><Pencil className="size-4" aria-hidden />{t('serverPlans.edit.open')}</Link>
        </Button>
      ) : null}
      {trip.status === 'PLANNED' ? (
        <Button ref={vehicleRef} type="button" variant="secondary" onClick={() => setChangingVehicle(true)}>
          <Truck className="size-4" aria-hidden />{t('trips.changeVehicle')}
        </Button>
      ) : null}
      {isCancellableStatus(trip.status) ? (
        <Button type="button" variant="secondary" onClick={() => setCancelling(true)}>
          <Ban className="size-4" aria-hidden />{t('serverPlans.cancel.open')}
        </Button>
      ) : null}
      {trip.status === 'PLANNED' ? (
        <ChangeVehicleDialog tripId={String(trip.id)} open={changingVehicle} onOpenChange={setChangingVehicle} returnFocusTo={vehicleRef} />
      ) : null}
      <BackendCancelTripDialog tripId={String(trip.id)} tripCode={trip.tripCode} inTransit={trip.status === 'IN_TRANSIT'} open={cancelling} onOpenChange={setCancelling} />
    </>
  )
}

/** Gỡ một yêu cầu giao khỏi chuyến (`DELETE …/delivery-requirements/{id}`), hỏi lại trước khi gửi. */
export function RemoveRequirementButton({ tripId, requirementId }: { tripId: string; requirementId: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const remove = useRemoveBackendRequirementMutation(tripId)
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Unlink className="size-4" aria-hidden />{t('serverPlans.removeRequirement.open')}<span className="sr-only"> #{requirementId}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        danger
        title={t('serverPlans.removeRequirement.title', { id: requirementId })}
        description={t('serverPlans.removeRequirement.description')}
        cancelLabel={t('serverPlans.removeRequirement.keep')}
        confirmLabel={t('serverPlans.removeRequirement.confirm')}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(requirementId, {
          onSuccess: () => {
            toast.success(t('serverPlans.removeRequirement.done', { id: requirementId }))
            setOpen(false)
          },
          onError: (error) => toast.error(dataErrorMessage(error, t)),
        })}
      />
    </>
  )
}
