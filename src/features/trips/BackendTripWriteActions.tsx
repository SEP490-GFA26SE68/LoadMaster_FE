import { Ban, Pencil, Unlink } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { BackendCancelTripDialog } from './BackendCancelTripDialog'
import { BackendTripEditDialog } from './BackendTripEditDialog'
import type { TripDetailApiResponse } from './trips-api'
import { useRemoveBackendRequirementMutation } from './useTripEditBackendQuery'

type Status = TripDetailApiResponse['status']

/** Máy chủ chỉ sửa chuyến Nháp / Đã lập kế hoạch (`TRIP_NOT_EDITABLE`), huỷ thêm được chuyến Đang xếp hàng (`TRIP_NOT_CANCELLABLE`). */
export const isEditableStatus = (status: Status) => status === 'DRAFT' || status === 'PLANNED'
export const isCancellableStatus = (status: Status) => isEditableStatus(status) || status === 'LOADING'

/** Hai nút phụ "Sửa chuyến" và "Huỷ chuyến" của Chi tiết chuyến bản máy chủ; nơi gọi đã xét quyền `trips.edit`. */
export function BackendTripWriteActions({ trip }: { trip: TripDetailApiResponse }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  return (
    <>
      {isEditableStatus(trip.status) ? (
        <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil className="size-4" aria-hidden />{t('serverPlans.edit.open')}
        </Button>
      ) : null}
      {isCancellableStatus(trip.status) ? (
        <Button type="button" variant="secondary" onClick={() => setCancelling(true)}>
          <Ban className="size-4" aria-hidden />{t('serverPlans.cancel.open')}
        </Button>
      ) : null}
      {editing ? <BackendTripEditDialog trip={trip} open={editing} onOpenChange={setEditing} /> : null}
      <BackendCancelTripDialog tripId={String(trip.id)} tripCode={trip.tripCode} open={cancelling} onOpenChange={setCancelling} />
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
