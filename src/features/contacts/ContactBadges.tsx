import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import type { ContactRequestType, ContactStatus } from '@/lib/mock-db'

/**
 * Chip của yêu cầu liên hệ, theo ngữ pháp chấm của AGENTS mục 5: Mới là chờ người xử lý (hổ phách, vòng rỗng), Đang xử lý là đang chạy
 * (xanh lam, quầng), Đã giải quyết là xong (xanh lá đặc), Đã đóng là xám đặc. Loại chỉ là nhãn xám: không mượn màu của trạng thái.
 */
const STATUS_LOOK: Record<ContactStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  NEW: { tone: 'warning', dot: 'ring' },
  IN_PROGRESS: { tone: 'azure', dot: 'halo' },
  RESOLVED: { tone: 'success', dot: 'solid' },
  CLOSED: { tone: 'neutral', dot: 'solid' },
}

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  const t = useT()
  const look = STATUS_LOOK[status]
  return <Badge tone={look.tone} dot={look.dot}>{t(`contacts.statuses.${status}`)}</Badge>
}

export function ContactTypeBadge({ type }: { type: ContactRequestType }) {
  const t = useT()
  return <Badge shape="tag">{t(`contacts.types.${type}`)}</Badge>
}
