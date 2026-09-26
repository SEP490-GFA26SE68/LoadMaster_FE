import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { TripStatus } from '@/types/trip'

type StatusSpec = {
  tone: BadgeTone
  dot: BadgeDot
  /** Tông chấm khác tông chip: đã huỷ là chip xám chấm đỏ. */
  dotTone?: BadgeTone
  /** Cần người dùng xử lý: thêm viền cùng tông. */
  outlined?: boolean
  /** Đã huỷ: chữ gạch ngang. */
  struck?: boolean
}

/**
 * Trạng thái vòng đời chuyến theo V2.3 (`design/v2.3/screens/web/Main.jpg`). Màu kể giai đoạn: xám = nháp, hổ phách = cần bạn,
 * cyan = sẵn sàng, tím = đang chạy, xanh lá = xong. Chấm kể nhịp: đặc = trạng thái · vòng rỗng = chờ người kế tiếp · quầng = đang
 * chạy · quay = đang tính. Nhãn nằm ở nhánh `status` của từ điển (LM-070).
 */
const STATUS: Record<TripStatus, StatusSpec> = {
  nhap: { tone: 'neutral', dot: 'solid' },
  dang_toi_uu: { tone: 'violet', dot: 'spin' },
  da_toi_uu: { tone: 'warning', dot: 'ring' },
  can_xem_lai: { tone: 'warning', dot: 'halo', outlined: true },
  da_duyet: { tone: 'cyan', dot: 'solid' },
  dang_xep_hang: { tone: 'violet', dot: 'halo' },
  da_xep_xong: { tone: 'violet', dot: 'ring' },
  dang_giao: { tone: 'violet', dot: 'halo' },
  hoan_thanh: { tone: 'success', dot: 'solid' },
  da_huy: { tone: 'neutral', dot: 'solid', dotTone: 'danger', struck: true },
}

/** `className` đè cỡ của chip, ví dụ bản 16px cho màn cảm ứng kho và tài xế (mục 10). */
export function StatusBadge({ status, className }: { status: TripStatus; className?: string }) {
  const t = useT()
  const spec = STATUS[status]
  return (
    <Badge
      tone={spec.tone}
      dot={spec.dot}
      dotTone={spec.dotTone}
      outlined={spec.outlined}
      className={cn(spec.struck && 'line-through', className)}
    >
      {t(`status.${status}`)}
    </Badge>
  )
}

export { STATUS as TRIP_STATUS }
