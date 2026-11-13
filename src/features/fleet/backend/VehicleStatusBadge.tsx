import {
  Badge,
  type BadgeDot,
  type BadgeTone,
} from '@/components/ui/Badge'

import { useT } from '@/lib/i18n'

import { VehicleStatusCell as StoreVehicleStatusCell } from '../VehicleStatusBadge'
import { fleetStateOf } from './vehicle-status'
import type { Vehicle, VehicleStatus } from './vehicles-api'

const STATUS_KEYS = ['AVAILABLE', 'IN_TRIP', 'MAINTENANCE', 'RETIRED', 'available', 'in_use', 'maintenance', 'retired'] as const
const isStatusKey = (status: string): status is (typeof STATUS_KEYS)[number] => (STATUS_KEYS as readonly string[]).includes(status)

/**
 * Trạng thái xe lấy trực tiếp từ BE hoặc mock DB.
 *
 * AVAILABLE / available: Xe sẵn sàng
 * IN_TRIP / in_use: Xe đang thực hiện chuyến
 * MAINTENANCE / maintenance: Xe đang bảo dưỡng
 * RETIRED / retired: Xe đã ngừng sử dụng
 */
const TONE: Record<
  string,
  {
    tone: BadgeTone
    dot: BadgeDot
  }
> = {
  AVAILABLE: {
    tone: 'success',
    dot: 'solid',
  },
  available: {
    tone: 'success',
    dot: 'solid',
  },
  IN_TRIP: {
    tone: 'azure',
    dot: 'halo',
  },
  in_use: {
    tone: 'azure',
    dot: 'halo',
  },
  MAINTENANCE: {
    tone: 'neutral',
    dot: 'solid',
  },
  maintenance: {
    tone: 'neutral',
    dot: 'solid',
  },
  RETIRED: {
    tone: 'neutral',
    dot: 'solid',
  },
  retired: {
    tone: 'neutral',
    dot: 'solid',
  },
}

export function VehicleStatusBadge({
  status,
}: {
  status: VehicleStatus | string
}) {
  const t = useT()
  const spec = TONE[status] ?? {
    tone: 'neutral' as BadgeTone,
    dot: 'solid' as BadgeDot,
  }

  return (
    <Badge
      tone={spec.tone}
      dot={spec.dot}
    >
      {isStatusKey(status) ? t(`fleet.status.${status}`) : status}
    </Badge>
  )
}

/** Ô trạng thái trong bảng đội xe: dùng chung ô của màn kho mẫu — chip, chuyến đang dùng xe hoặc ngày và ghi chú bảo dưỡng. */
export function VehicleStatusCell({ vehicle }: { vehicle: Vehicle }) {
  return <StoreVehicleStatusCell state={fleetStateOf(vehicle)} serverSource />
}
