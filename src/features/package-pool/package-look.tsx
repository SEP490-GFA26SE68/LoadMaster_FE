import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import type { PackageFlag, PackageStatus } from '@/lib/mock-db'

/**
 * Chip trạng thái kiện của kho kiện (FE-3b-01) theo ngữ pháp chấm V2.3: xám đã nhập · cyan đã gán chuyến · cyan vòng rỗng đã soạn
 * (chờ kho xếp) · xanh lam vòng rỗng đã xếp (chờ xuất phát) · xanh lam có quầng đang vận chuyển · xanh lá đã giao · hổ phách hoàn trả.
 * `className`: màn cảm ứng (Tra cứu kiện của kho) phóng chip lên chữ 16 px.
 */
const STATUS: Record<PackageStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  IMPORTED: { tone: 'neutral', dot: 'solid' },
  ASSIGNED: { tone: 'cyan', dot: 'solid' },
  STAGED: { tone: 'cyan', dot: 'ring' },
  LOADED: { tone: 'azure', dot: 'ring' },
  IN_TRANSIT: { tone: 'azure', dot: 'halo' },
  DELIVERED: { tone: 'success', dot: 'solid' },
  RETURNED: { tone: 'warning', dot: 'solid' },
}

export function PackageStatusBadge({ status, className }: { status: PackageStatus; className?: string }) {
  const t = useT()
  const spec = STATUS[status]
  return <Badge tone={spec.tone} dot={spec.dot} className={className}>{t(`common.packageStatuses.${status}`)}</Badge>
}

/** Cờ của kiện (D-92): nhãn hổ phách có viền — kiện mang cờ cần điều phối viên xử lý trước khi vào yêu cầu giao hay chuyến. */
export function PackageFlagTag({ flag, className }: { flag: PackageFlag; className?: string }) {
  const t = useT()
  return <Badge shape="tag" tone="warning" outlined className={className}>{t(`common.packageFlags.${flag}`)}</Badge>
}

/** Ô không có giá trị: gạch ngang cho mắt, "Không có" cho trình đọc màn hình. */
export function None() {
  const t = useT()
  return <span className="text-ink-3"><span aria-hidden>—</span><span className="sr-only">{t('sourcing.packages.none')}</span></span>
}

