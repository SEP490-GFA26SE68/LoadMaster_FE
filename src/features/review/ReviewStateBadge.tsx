import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import type { ReviewDecisionKind } from '@/lib/mock-db'

export type ReviewState = 'approved' | 'pending' | ReviewDecisionKind

/**
 * Chip số phận của một phương án (LM-104), theo ngữ pháp chấm của V2.3: cyan đặc = đã duyệt, hổ phách vòng rỗng = chờ quản lý, đỏ =
 * bị từ chối, hổ phách đặc = quản lý trả lại kèm yêu cầu (tối ưu lại, đổi xe, tách chuyến) — việc của điều phối viên.
 */
const LOOK: Record<ReviewState, { tone: BadgeTone; dot: BadgeDot }> = {
  approved: { tone: 'cyan', dot: 'solid' },
  pending: { tone: 'warning', dot: 'ring' },
  rejected: { tone: 'danger', dot: 'solid' },
  reoptimize_requested: { tone: 'warning', dot: 'solid' },
  change_vehicle_suggested: { tone: 'warning', dot: 'solid' },
  split_trip_suggested: { tone: 'warning', dot: 'solid' },
}

export function ReviewStateBadge({ state }: { state: ReviewState }) {
  const t = useT()
  const { tone, dot } = LOOK[state]
  return <Badge tone={tone} dot={dot}>{t(`review.states.${state}`)}</Badge>
}
