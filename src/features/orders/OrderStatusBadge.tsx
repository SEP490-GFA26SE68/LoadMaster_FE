import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import type { OrderStatus } from '@/lib/mock-db'
import { useT } from '@/lib/i18n'

/**
 * Chip trạng thái đơn theo ngữ pháp chấm V2.3: chờ gán = chờ bạn (vòng rỗng hổ phách), đã gán = cyan, đã giao = xanh lá, đã huỷ = đỏ
 * trọn (không gạch chữ, AGENTS mục 5).
 */
const LOOK: Record<OrderStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  pending: { tone: 'warning', dot: 'ring' },
  assigned: { tone: 'cyan', dot: 'solid' },
  delivered: { tone: 'success', dot: 'solid' },
  cancelled: { tone: 'danger', dot: 'solid' },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useT()
  const look = LOOK[status]
  return <Badge tone={look.tone} dot={look.dot}>{t(`orders.status.${status}`)}</Badge>
}
