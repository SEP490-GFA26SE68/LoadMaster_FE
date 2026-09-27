import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import type { PackageType, RegisteredPackageStatus } from '@/lib/mock-db'

/**
 * Chip trạng thái kiện đăng ký (LM-104) theo ngữ pháp chấm V2.3: xám đã đăng ký (chưa đi đâu) · xanh lam có quầng đang trên đường
 * tới logistics · cyan đã nhận ở kho · cyan vòng rỗng đã lên kế hoạch (chờ kho xếp) · xanh lam đặc đã lên xe · xanh lá đã giao.
 */
const STATUS: Record<RegisteredPackageStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  registered: { tone: 'neutral', dot: 'solid' },
  in_shipment: { tone: 'azure', dot: 'halo' },
  received: { tone: 'cyan', dot: 'solid' },
  planned: { tone: 'cyan', dot: 'ring' },
  loaded: { tone: 'azure', dot: 'solid' },
  delivered: { tone: 'success', dot: 'solid' },
}

export function PackageStatusBadge({ status }: { status: RegisteredPackageStatus }) {
  const t = useT()
  const spec = STATUS[status]
  return <Badge tone={spec.tone} dot={spec.dot}>{t(`sourcing.packages.status.${status}`)}</Badge>
}

/** "50 × 35 × 25 cm · 13 kg" của một loại kiện, mono (số đo). */
export function TypeMeasure({ type, className }: { type: PackageType; className?: string }) {
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
