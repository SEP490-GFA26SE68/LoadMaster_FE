import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import { tripSubStatusLabel } from '@/lib/trip-sub-status'
import type { TripStatus, TripSubStatus } from '@/types/trip'

type StatusSpec = {
  tone: BadgeTone
  dot: BadgeDot
}

/**
 * Sáu trạng thái chuyến của backend (FE-0-05, D-81). Màu kể giai đoạn: xám = nháp, cyan = đã lập kế hoạch, xanh lam = đang chạy
 * (đang xếp hàng, đang vận chuyển), xanh lá = đã giao, đỏ = huỷ. Chấm kể nhịp: đặc = trạng thái · vòng rỗng = chờ người kế tiếp ·
 * quầng = đang chạy. Việc chờ người dùng (chờ duyệt, lỗi thời) nằm ở dòng phụ. Nhãn ở nhánh `status` của từ điển (LM-070).
 */
const STATUS: Record<TripStatus, StatusSpec> = {
  DRAFT: { tone: 'neutral', dot: 'solid' },
  PLANNED: { tone: 'cyan', dot: 'solid' },
  LOADING: { tone: 'azure', dot: 'halo' },
  IN_TRANSIT: { tone: 'azure', dot: 'halo' },
  DELIVERED: { tone: 'success', dot: 'solid' },
  // Đã huỷ: chip đỏ trọn (nền, chữ, chấm) — không gạch ngang chữ, gạch ngang làm nhãn khó đọc (26/09/2026)
  CANCELLED: { tone: 'danger', dot: 'solid' },
}

/** `className` đè cỡ của chip, ví dụ bản 16px cho màn cảm ứng kho và tài xế (mục 10). */
export function StatusBadge({ status, className }: { status: TripStatus; className?: string }) {
  const t = useT()
  const spec = STATUS[status]
  return (
    <Badge tone={spec.tone} dot={spec.dot} className={className}>
      {t(`status.${status}`)}
    </Badge>
  )
}

/**
 * Dòng phụ theo nghĩa (FE-0-05). Dưới Đã lập kế hoạch: chờ duyệt là hổ phách chấm vòng rỗng (chờ người kế tiếp), đã duyệt là cyan,
 * lỗi thời là hổ phách có viền (việc chờ người dùng). Dưới Đang xếp hàng: tiến độ kho và xếp xong là xanh lam.
 */
const SUB_STATUS: Record<TripSubStatus['kind'], { tone: BadgeTone; dot?: BadgeDot; outlined?: boolean }> = {
  awaitingApproval: { tone: 'warning', dot: 'ring' },
  approved: { tone: 'cyan' },
  stale: { tone: 'warning', outlined: true },
  loading: { tone: 'azure' },
  loaded: { tone: 'azure' },
  // Điểm trễ hạn dự kiến của tuyến đã tối ưu (FE-4b-09): việc chờ điều phối viên, như lỗi thời
  lateStops: { tone: 'warning', outlined: true },
}

/** Dòng phụ cạnh chip trạng thái, cùng một kiểu ở mọi màn (nhãn 20 px; `className` đè cỡ cho màn cảm ứng). `null` thì không vẽ gì. */
export function TripSubStatusTag({ sub, className }: { sub: TripSubStatus | null | undefined; className?: string }) {
  const t = useT()
  const format = useFormat()
  if (!sub) return null
  const spec = SUB_STATUS[sub.kind]
  return (
    <Badge shape="tag" tone={spec.tone} dot={spec.dot} outlined={spec.outlined} className={className}>
      {tripSubStatusLabel(sub, t, format)}
    </Badge>
  )
}

export { STATUS as TRIP_STATUS }
