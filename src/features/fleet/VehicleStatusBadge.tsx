import {
  Badge,
  type BadgeDot,
  type BadgeTone,
} from '@/components/ui/Badge'

import { useT } from '@/lib/i18n'

import type { VehicleStatus } from './vehicles-api'

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
      {t(`fleet.status.${status}`)}
    </Badge>
  )
}

/**
 * Ô trạng thái trong bảng đội xe.
 *
 * Hiện BE chỉ trả trạng thái xe,
 * chưa trả mã chuyến đang chạy hoặc
 * chi tiết lịch sử bảo dưỡng.
 */
export function VehicleStatusCell({
  status,
}: {
  status: VehicleStatus
}) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-1 whitespace-normal">
      <VehicleStatusBadge status={status} />
    </span>
  )
}
