import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import type { TicketKind, TicketStatus } from '@/lib/mock-db'

/**
 * Chip của yêu cầu hỗ trợ (FE-8-07), theo ngữ pháp chấm của AGENTS mục 5: Mở là chờ người xử lý tiếp (hổ phách, vòng rỗng), Đang xử lý
 * là đang chạy (xanh lam, quầng), Đã đóng là xong việc (xám đặc). Loại chỉ là nhãn: không mượn màu của trạng thái.
 */
const STATUS_LOOK: Record<TicketStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  OPEN: { tone: 'warning', dot: 'ring' },
  IN_PROGRESS: { tone: 'azure', dot: 'halo' },
  CLOSED: { tone: 'neutral', dot: 'solid' },
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const t = useT()
  const look = STATUS_LOOK[status]
  return <Badge tone={look.tone} dot={look.dot}>{t(`support.statuses.${status}`)}</Badge>
}

export function TicketKindBadge({ kind }: { kind: TicketKind }) {
  const t = useT()
  return <Badge shape="tag" tone={kind === 'BILLING' ? 'cyan' : 'neutral'}>{t(`support.kinds.${kind}`)}</Badge>
}
