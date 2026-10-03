import { CircleX, Ellipsis, FileText, Pencil, Truck } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { isCancellablePhase, tripStatus, type Trip, type TripPhase } from '@/lib/mock-db'
import { useT } from '@/lib/i18n'
import { CancelTripDialog } from './CancelTripDialog'
import { ChangeVehicleDialog } from './ChangeVehicleDialog'

/** Kho còn cho sửa tên, ngày chạy, tài xế ở các pha này (D-45); xe, điểm giao, kiện chỉ sửa được ở `planning`. */
const FRAME_EDITABLE: readonly TripPhase[] = ['planning', 'loading', 'loaded']

/**
 * Menu thao tác phụ ở header Chi tiết chuyến (LM-088): sửa thông tin chuyến, đổi xe của chuyến Đã lập kế hoạch (FE-5b-08, D-80), huỷ
 * chuyến, mở báo cáo của chuyến đã hoàn thành (LM-104).
 * Chỉ hiện với người được sửa chuyến; mục nào
 * pha hiện tại không cho làm thì không hiện (không nút giả, D-20). Hộp thoại luôn gắn ở đây để còn sống tới khi làm xong,
 * kể cả khi menu vừa ẩn vì chuyến đã sang "Đã huỷ".
 */
export function TripActionsMenu({ trip }: { trip: Pick<Trip, 'id' | 'phase' | 'routePlan'> }) {
  const t = useT()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const canEditFrame = FRAME_EDITABLE.includes(trip.phase)
  const canCancel = isCancellablePhase(trip.phase)
  // Chuyến Nháp đổi xe ở form sửa chuyến; đã lập kế hoạch thì đổi qua hộp thoại có kiểm xe (kho từ chối `TRIP_NOT_PLANNED` nếu khác)
  const canChangeVehicle = tripStatus(trip) === 'PLANNED'
  // Review 1 (LM-104): chuyến đã hoàn thành có báo cáo chuyến
  const canReport = trip.phase === 'completed'

  return (
    <>
      {canEditFrame || canCancel || canReport ? (
        // Không modal: hộp thoại mở ngay từ một mục menu, menu modal sẽ để lại `pointer-events: none` trên body
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            {/* V2.3: nút kính chỉ có icon trên dải trời; tên truy cập giữ "Thao tác" */}
            <Button ref={triggerRef} variant="glass" className="size-10 px-0 [&_svg]:size-4.5" aria-label={t('trips.detail.actions')}>
              <Ellipsis strokeWidth={1.75} aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEditFrame ? (
              <DropdownMenuItem asChild>
                <Link to={`/chuyen/${trip.id}/sua`}>
                  <Pencil strokeWidth={1.5} />
                  {t('trips.detail.edit')}
                </Link>
              </DropdownMenuItem>
            ) : null}
            {canChangeVehicle ? (
              <DropdownMenuItem onSelect={() => setVehicleOpen(true)}>
                <Truck strokeWidth={1.5} />
                {t('trips.changeVehicle')}
              </DropdownMenuItem>
            ) : null}
            {canReport ? (
              <DropdownMenuItem asChild>
                <Link to={`/chuyen/${trip.id}/bao-cao`}>
                  <FileText strokeWidth={1.5} />
                  {t('tripReport.title')}
                </Link>
              </DropdownMenuItem>
            ) : null}
            {canCancel ? (
              <DropdownMenuItem tone="danger" onSelect={() => setCancelOpen(true)}>
                <CircleX strokeWidth={1.5} />
                {t('trips.detail.cancel')}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <CancelTripDialog trip={trip} open={cancelOpen} onOpenChange={setCancelOpen} returnFocusTo={triggerRef} />
      <ChangeVehicleDialog tripId={trip.id} open={vehicleOpen} onOpenChange={setVehicleOpen} returnFocusTo={triggerRef} />
    </>
  )
}
