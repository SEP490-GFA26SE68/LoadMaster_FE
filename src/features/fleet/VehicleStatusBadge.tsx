
import {
  Badge,
  type BadgeDot,
  type BadgeTone,
} from '@/components/ui/Badge'

import { useT } from '@/lib/i18n'

import type { VehicleStatus } from './vehicles-api'

/**
 * Trạng thái xe lấy trực tiếp từ BE.
 *
 * AVAILABLE: Xe sẵn sàng
 * IN_TRIP: Xe đang thực hiện chuyến
 * MAINTENANCE: Xe đang bảo dưỡng
 * RETIRED: Xe đã ngừng sử dụng
 */
const TONE: Record<
  VehicleStatus,
  {
    tone: BadgeTone
    dot: BadgeDot
  }
> = {
  AVAILABLE: {
    tone: 'success',
    dot: 'solid',
  },

  IN_TRIP: {
    tone: 'azure',
    dot: 'halo',
  },

  MAINTENANCE: {
    tone: 'neutral',
    dot: 'solid',
  },

  RETIRED: {
    tone: 'neutral',
    dot: 'solid',
  },
}

/** Accept both vehicle data sources at this display boundary; unknown is never "available". */
function displayStatus(status: unknown): VehicleStatus | null {
  switch (status) {
    case 'available': return 'AVAILABLE'
    case 'in_use': return 'IN_TRIP'
    case 'maintenance': return 'MAINTENANCE'
    case 'AVAILABLE':
    case 'IN_TRIP':
    case 'MAINTENANCE':
    case 'RETIRED': return status
    default: return null
  }
}

export function VehicleStatusBadge({ status }: { status?: unknown }) {
  const t = useT()
  const normalized = displayStatus(status)
  const spec = normalized === null ? null : TONE[normalized]

  return (
    <Badge tone={spec?.tone ?? 'neutral'} dot={spec?.dot ?? 'ring'}>
      {normalized === null ? t('fleet.status.unknown') : t(`fleet.status.${normalized}`)}
    </Badge>
  )
}

/** Display-only cell; validation never changes the vehicle or optimization job state. */
export function VehicleStatusCell({ status }: { status?: unknown }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-1 whitespace-normal">
      <VehicleStatusBadge status={status} />
    </span>
  )
}
