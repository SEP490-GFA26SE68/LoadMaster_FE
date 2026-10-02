import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import type { PackageStatus, PackageType } from '@/lib/mock-db'

/**
 * Chip trạng thái kiện của kho kiện (FE-3b-01) theo ngữ pháp chấm V2.3: xám đã nhập · cyan đã gán chuyến · cyan vòng rỗng đã soạn
 * (chờ kho xếp) · xanh lam vòng rỗng đã xếp (chờ xuất phát) · xanh lam có quầng đang vận chuyển · xanh lá đã giao · hổ phách hoàn trả.
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

export function PackageStatusBadge({ status }: { status: PackageStatus }) {
  const t = useT()
  const spec = STATUS[status]
  return <Badge tone={spec.tone} dot={spec.dot}>{t(`common.packageStatuses.${status}`)}</Badge>
}

/** "50 × 35 × 25 cm · 13 kg" của một loại kiện hoặc một kiện, mono (số đo). */
export function TypeMeasure({ type, className }: { type: Pick<PackageType, 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg'>; className?: string }) {
  const t = useT()
  const format = useFormat()
  return (
    <span className={className ?? 'font-mono text-caption text-ink-3 tabular-nums'}>
      {t('sourcing.register.typeSummary', {
        dimensions: format.dimensions(type.lengthCm, type.widthCm, type.heightCm),
        weight: format.weight(type.weightKg),
      })}
    </span>
  )
}
