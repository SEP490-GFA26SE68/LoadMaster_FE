import { Truck, TriangleAlert } from 'lucide-react'
import { useId, useState, type RefObject } from 'react'
import { toast } from 'sonner'
import { VehicleName } from '@/components/VehicleName'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Spinner } from '@/components/ui/Spinner'
import type { VehicleFitIssue } from '@/domain/constraints'
import { VehicleStatusBadge } from '@/features/fleet/VehicleStatusBadge'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { VehicleChoice } from './trip-vehicle-api'
import { useChangeTripVehicleMutation, useVehicleChoicesQuery } from './useTripVehicleQuery'

/** Mã dòng kiện không lọt xe liệt kê nguyên; nhiều hơn thì "… và N dòng khác". */
const LISTED_PACKAGES = 3

type Format = ReturnType<typeof useFormat>

/** Câu của một lý do `vehicleFit`: lỗi (xe không chở được) hoặc cảnh báo loại hàng — cùng câu với thẻ Phân nhóm hàng. */
function fitReason(issue: VehicleFitIssue, t: TFunction, format: Format): string {
  switch (issue.code) {
    case 'CARGO_TOO_LARGE': {
      const { count, packageIds } = issue.params
      const listed = format.list(packageIds.slice(0, LISTED_PACKAGES))
      const packages = count > LISTED_PACKAGES ? t('trips.vehicleChange.morePackages', { list: listed, more: format.integer(count - LISTED_PACKAGES) }) : listed
      return t('trips.vehicleChange.reasons.CARGO_TOO_LARGE', { count, packages })
    }
    case 'CARGO_VOLUME_EXCEEDED':
      return t('trips.vehicleChange.reasons.CARGO_VOLUME_EXCEEDED', { total: format.volumeM3(issue.params.totalCm3), cargo: format.volumeM3(issue.params.cargoCm3) })
    case 'CARGO_WEIGHT_EXCEEDED':
      return t('trips.vehicleChange.reasons.CARGO_WEIGHT_EXCEEDED', { total: format.weight(issue.params.totalKg), max: format.weight(issue.params.maxPayloadKg) })
    case 'AXLE_CAPACITY_EXCEEDED':
      return t('trips.vehicleChange.reasons.AXLE_CAPACITY_EXCEEDED', { total: format.weight(issue.params.totalKg), capacity: format.weight(issue.params.capacityKg) })
    default:
      return t(`trips.segregation.warnings.${issue.code}`, { count: issue.params.count })
  }
}

/** Vì sao không chọn được xe này, theo thứ tự kho kiểm: xe đang dùng, chưa sẵn sàng, rồi các lỗi chở hàng. */
function blockedReasons(choice: VehicleChoice, t: TFunction, format: Format): string[] {
  if (choice.current) return [t('trips.vehicleChange.current')]
  const notReady = choice.status === 'maintenance'
    ? [t('trips.vehicleChange.maintenance')]
    : choice.status === 'in_use' ? [t('trips.vehicleChange.busy', { tripId: choice.busyTripId ?? '' })] : []
  return [...notReady, ...choice.fit.issues.filter((issue) => issue.severity === 'error').map((issue) => fitReason(issue, t, format))]
}

/**
 * Đổi xe của chuyến Đã lập kế hoạch (FE-5b-08, D-80) — mở từ Chi tiết chuyến và Planner. Mọi xe của công ty hiện cùng trạng thái;
 * xe không sẵn sàng hoặc không chở được hàng (kích thước, thể tích, tải trọng, trục — `vehicleFit`) bị khoá kèm lý do ngay tại dòng,
 * cảnh báo loại hàng hiện nhưng không khoá. Kho kiểm lại khi đổi; kho từ chối thì câu lỗi hiện trong hộp thoại. Đổi xong phương án
 * hiện tại lỗi thời — hộp thoại nói trước điều đó.
 */
export function ChangeVehicleDialog({ tripId, open, onOpenChange, returnFocusTo }: {
  tripId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  returnFocusTo?: RefObject<HTMLElement | null>
}) {
  const t = useT()
  const format = useFormat()
  const listId = useId()
  const [picked, setPicked] = useState('')
  const query = useVehicleChoicesQuery(tripId, open)
  const change = useChangeTripVehicleMutation(tripId)
  const choices = query.data?.choices ?? []
  // Xe đã chọn có thể hết chọn được sau khi danh sách đọc lại (xe vừa vào bảo dưỡng)
  const selected = choices.find((choice) => choice.vehicle.id === picked && choice.selectable)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPicked('')
      change.reset()
    }
    onOpenChange(next)
  }

  function handleSubmit() {
    if (!selected) return
    change.mutate(selected.vehicle.id, {
      onSuccess: () => {
        toast.success(t('trips.vehicleChange.done', { id: tripId }))
        handleOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-150"
        onCloseAutoFocus={(event) => {
          if (!returnFocusTo?.current) return
          event.preventDefault()
          returnFocusTo.current.focus()
        }}
      >
        <DialogHeader icon={Truck} title={t('trips.vehicleChange.title', { id: tripId })} description={t('trips.vehicleChange.description')} />
        <div className="flex flex-col gap-3 px-7 pt-4 pb-5">
          {query.data ? (
            <>
              <p className="text-small text-ink-2 tabular-nums">
                {t('trips.vehicleChange.cargo', {
                  count: format.integer(query.data.cargo.count),
                  weight: format.weight(query.data.cargo.totalKg),
                  volume: format.volumeM3(query.data.cargo.totalCm3),
                })}
              </p>
              <RadioGroup aria-label={t('trips.vehicleChange.vehicles')} value={selected ? picked : ''} onValueChange={setPicked}
                className="max-h-[46dvh] gap-2 overflow-y-auto pr-1">
                {choices.map((choice) => <ChoiceRow key={choice.vehicle.id} id={`${listId}-${choice.vehicle.id}`} choice={choice} />)}
              </RadioGroup>
              {choices.some((choice) => choice.selectable) ? null : <p className="text-small text-ink-2">{t('trips.vehicleChange.noneSelectable')}</p>}
            </>
          ) : query.isError ? (
            <p role="alert" className="text-small text-danger">{t('trips.vehicleChange.loadError')}</p>
          ) : (
            <p role="status" className="flex items-center gap-2 text-small text-ink-2"><Spinner />{t('trips.vehicleChange.loading')}</p>
          )}
          {change.isError ? <p role="alert" className="text-caption text-danger">{dataErrorMessage(change.error, t)}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>{t('trips.vehicleChange.cancel')}</Button>
          <Button type="button" variant="primary" disabled={!selected} loading={change.isPending} onClick={handleSubmit}>
            <Truck strokeWidth={1.5} />{t('trips.vehicleChange.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Một xe: ô chọn, tên kèm biển số, lòng thùng và tải, chip trạng thái; dưới là lý do khoá (nếu có) rồi cảnh báo loại hàng. */
function ChoiceRow({ id, choice }: { id: string; choice: VehicleChoice }) {
  const t = useT()
  const format = useFormat()
  const { vehicle } = choice
  const blocked = choice.selectable ? [] : blockedReasons(choice, t, format)
  const warnings = choice.current ? [] : choice.fit.issues.filter((issue) => issue.severity === 'warning').map((issue) => fitReason(issue, t, format))
  const notesId = `${id}-notes`
  return (
    <div data-vehicle-choice={vehicle.id} className={cn('flex items-start gap-3 rounded-md border border-border px-3.5 py-3', choice.selectable ? 'bg-bg' : 'bg-surface')}>
      <RadioGroupItem id={id} value={vehicle.id} disabled={!choice.selectable} className="mt-0.5"
        aria-describedby={blocked.length + warnings.length > 0 ? notesId : undefined} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <label htmlFor={id} className={cn('min-w-0 text-body font-semibold', choice.selectable ? 'cursor-pointer text-ink-strong' : 'text-ink-2')}>
            <VehicleName name={vehicle.name} />
          </label>
          <VehicleStatusBadge status={choice.status} />
        </div>
        <p className="text-small text-ink-3 tabular-nums">
          {t('trips.vehicleChange.spec', {
            dimensions: format.dimensions(vehicle.innerLengthCm, vehicle.innerWidthCm, vehicle.innerHeightCm),
            payload: format.weight(vehicle.maxPayloadKg),
          })}
        </p>
        {blocked.length + warnings.length > 0 ? (
          <ul id={notesId} className="m-0 flex list-none flex-col gap-0.5 p-0 text-small">
            {blocked.map((reason) => <li key={reason} className="text-ink-2">{reason}</li>)}
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-1.5 text-ink-2">
                <TriangleAlert aria-hidden className="mt-0.5 size-3.5 flex-none text-warning" strokeWidth={1.75} />{warning}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
