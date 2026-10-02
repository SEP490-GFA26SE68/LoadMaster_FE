import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import type { RequirementPriority, RequirementStatus } from '@/lib/mock-db'
import { useT } from '@/lib/i18n'

/**
 * Chip trạng thái yêu cầu giao theo ngữ pháp chấm V2.3 (AGENTS mục 5): chờ xếp chuyến = chờ người kế tiếp (vòng rỗng hổ phách), đã vào
 * chuyến = cyan, đang giao = xanh lam có quầng (đang chạy), đã giao = xanh lá, giao thiếu = đỏ.
 */
const STATUS_LOOK: Record<RequirementStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  PENDING: { tone: 'warning', dot: 'ring' },
  ASSIGNED: { tone: 'cyan', dot: 'solid' },
  IN_TRIP: { tone: 'azure', dot: 'halo' },
  DELIVERED: { tone: 'success', dot: 'solid' },
  PARTIAL: { tone: 'danger', dot: 'solid' },
}

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  const t = useT()
  const look = STATUS_LOOK[status]
  return <Badge tone={look.tone} dot={look.dot}>{t(`requirements.status.${status}`)}</Badge>
}

/** Thẻ ưu tiên: màu chỉ nhấn hai mức cần chú ý (Cao hổ phách, Khẩn đỏ); chữ luôn nói mức. */
const PRIORITY_TONE: Record<RequirementPriority, BadgeTone> = {
  LOW: 'neutral',
  NORMAL: 'neutral',
  HIGH: 'warning',
  URGENT: 'danger',
}

export function RequirementPriorityTag({ priority }: { priority: RequirementPriority }) {
  const t = useT()
  return <Badge shape="tag" tone={PRIORITY_TONE[priority]}>{t(`requirements.priority.${priority}`)}</Badge>
}
