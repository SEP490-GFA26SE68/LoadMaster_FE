import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import type { TripStatus, TripSubStatus } from '@/types/trip'

type StatusSpec = {
  tone: BadgeTone
  dot: BadgeDot
}

/**
 * Trạng thái chuyến theo backend (LM-104): năm trạng thái cộng Đã huỷ. Màu kể giai đoạn: xám = nháp, hổ phách = cần bạn duyệt,
 * cyan = đã duyệt, xanh lam = đang vận chuyển, xanh lá = xong, đỏ = huỷ. Chấm kể nhịp: đặc = trạng thái · vòng rỗng = chờ người kế
 * tiếp · quầng = đang chạy. Nhãn nằm ở nhánh `status` của từ điển (LM-070).
 */
const STATUS: Record<TripStatus, StatusSpec> = {
  nhap: { tone: 'neutral', dot: 'solid' },
  da_toi_uu: { tone: 'warning', dot: 'ring' },
  da_duyet: { tone: 'cyan', dot: 'solid' },
  dang_van_chuyen: { tone: 'azure', dot: 'halo' },
  hoan_thanh: { tone: 'success', dot: 'solid' },
  // Đã huỷ: chip đỏ trọn (nền, chữ, chấm) — không gạch ngang chữ, gạch ngang làm nhãn khó đọc (26/09/2026)
  da_huy: { tone: 'danger', dot: 'solid' },
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
 * Dòng phụ cạnh chip trạng thái (LM-104), cùng một kiểu ở mọi màn: lỗi thời là nhãn hổ phách có viền (việc chờ người dùng), tiến
 * độ kho là nhãn xanh lam. `null` thì không vẽ gì.
 */
export function TripSubStatusTag({ sub, className }: { sub: TripSubStatus | null | undefined; className?: string }) {
  const t = useT()
  const format = useFormat()
  if (!sub) return null
  switch (sub.kind) {
    case 'stale':
      return <Badge shape="tag" tone="warning" outlined className={className}>{t('status.sub.stale')}</Badge>
    case 'loading':
      return (
        <Badge shape="tag" tone="azure" className={className}>
          {t('status.sub.loading', { recorded: format.integer(sub.recorded), total: format.integer(sub.total) })}
        </Badge>
      )
    case 'loaded':
      return <Badge shape="tag" tone="azure" className={className}>{t('status.sub.loaded')}</Badge>
  }
}

export { STATUS as TRIP_STATUS }
