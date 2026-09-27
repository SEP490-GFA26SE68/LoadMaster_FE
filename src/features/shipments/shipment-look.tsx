import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import type { ShipmentStatus } from '@/lib/mock-db'

/**
 * Chip trạng thái lô hàng (LM-104) theo ngữ pháp chấm V2.3: xám nháp · xanh lam vòng rỗng đã bàn giao (chờ logistics quét) · xanh lam
 * có quầng đang nhận · xanh lá đã nhận đủ.
 */
const STATUS: Record<ShipmentStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  draft: { tone: 'neutral', dot: 'solid' },
  handed_over: { tone: 'azure', dot: 'ring' },
  partially_received: { tone: 'azure', dot: 'halo' },
  received: { tone: 'success', dot: 'solid' },
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const t = useT()
  const spec = STATUS[status]
  return <Badge tone={spec.tone} dot={spec.dot}>{t(`sourcing.shipments.status.${status}`)}</Badge>
}

/** Thanh nhận hàng gọn cho dòng bảng: rãnh 6px, phần đã nhận cùng gradient với thước đo V2.3. */
export function ReceiptMeter({ received, count }: { received: number; count: number }) {
  const percent = count === 0 ? 0 : Math.round((received / count) * 100)
  return (
    <span aria-hidden className="block h-1.5 w-16 flex-none overflow-hidden rounded-full bg-n-100">
      <span className="block h-full rounded-full bg-(image:--meter-fill)" style={{ width: `${percent}%` }} />
    </span>
  )
}
