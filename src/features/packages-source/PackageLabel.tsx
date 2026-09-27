import { LogoMark } from '@/components/brand/LogoMark'
import { QrCode } from '@/components/QrCode'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PackageLabel as PackageLabelData } from './packages-source-api'

/**
 * Một nhãn QR để dán lên kiện (LM-104): mã QR (in mã chữ bên dưới để gõ tay khi không quét được), mã kiện lớn, loại kiện, số đo,
 * mã lô / SKU và nhà sản xuất. Cùng một component cho bản xem trên màn và bản in — chỉ khác cỡ (`print`: đơn vị mm của khổ giấy).
 * Góc phải có logo một màu (LM-105): thương hiệu đi theo thùng hàng tới kho, tới khách; in đen trắng vẫn rõ.
 */
export function PackageLabel({ label, print = false }: { label: PackageLabelData; print?: boolean }) {
  const t = useT()
  const format = useFormat()
  const { package: pkg, type, owner } = label
  return (
    <article
      aria-label={pkg.id}
      className={cn(
        'flex items-center gap-3 border border-border bg-bg text-text',
        print ? 'h-[40mm] break-inside-avoid gap-[4mm] rounded-none p-[3mm]' : 'rounded-md p-3',
      )}
    >
      <QrCode token={pkg.qrToken} size={print ? 104 : 112} showToken className="flex-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-h3 leading-5 font-semibold tabular-nums">{pkg.id}</span>
          <span aria-hidden className="flex flex-none items-center gap-1 text-ink-strong">
            <LogoMark tone="mono" className={print ? 'size-[4mm]' : 'size-4'} />
            <span className="font-display text-micro leading-none font-bold font-stretch-106%">LoadMaster</span>
          </span>
        </div>
        <span className="line-clamp-2 text-small leading-4.5 font-medium">{type?.name ?? t('sourcing.labels.unknownType', { id: pkg.packageTypeId })}</span>
        {type ? (
          <span className="font-mono text-caption text-ink-2 tabular-nums">
            {t('sourcing.register.typeSummary', {
              dimensions: format.dimensions(type.lengthCm, type.widthCm, type.heightCm),
              weight: format.weight(type.weightKg),
            })}
          </span>
        ) : null}
        {pkg.reference ? <span className="truncate font-mono text-caption text-ink-2">{t('sourcing.labels.reference', { reference: pkg.reference })}</span> : null}
        {owner ? <span className="line-clamp-2 text-caption leading-4 text-ink-3">{owner.name}</span> : null}
      </div>
    </article>
  )
}
