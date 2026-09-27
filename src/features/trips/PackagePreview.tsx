import { effectiveOrientations } from '@/domain/geometry'
import type { CargoPackage } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'

/**
 * Thân panel kiện cho người chỉ xem (quản lý, chuyến đã khoá — D-41, D-45): hình, tổng khối lượng và thể tích đã ở đầu panel
 * (`PackagePanelHeader`), phần này nói số lượng, khối lượng một kiện, kích thước và yêu cầu xếp bằng lời. Mọi số từ chính kiện.
 */
export function PackagePreview({ pkg }: { pkg: CargoPackage }) {
  const t = useT()
  const format = useFormat()
  const stats = [
    { label: t('trips.packages.preview.quantity'), value: format.integer(pkg.quantity) },
    { label: t('trips.packages.preview.each'), value: format.weight(pkg.weightKg) },
  ]
  const requirements = [
    t('trips.packages.preview.fragility', { level: t(`trips.form.fragilityLevels.${pkg.fragilityLevel}`) }),
    ...(pkg.keepUpright ? [t('trips.packages.preview.upright')] : []),
    t('trips.packages.preview.orientations', { count: effectiveOrientations(pkg).length }),
    pkg.stackable
      ? t('trips.packages.preview.maxTopLoad', { weight: format.weight(pkg.maxTopLoadKg) })
      : t('trips.packages.preview.noStack'),
  ]

  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0 grid grid-cols-2 gap-x-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5 border-b border-line-soft py-2">
            <dt className="text-small text-ink-3">{stat.label}</dt>
            <dd className="m-0 font-display text-body font-[650] text-ink-strong tabular-nums">{stat.value}</dd>
          </div>
        ))}
        <div className="col-span-2 flex flex-col gap-0.5 border-b border-line-soft py-2">
          <dt className="text-small text-ink-3">{t('trips.packages.preview.dims')}</dt>
          <dd className="m-0 font-mono text-body text-ink-1 tabular-nums">{format.dimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1.5">
        <span className="text-small font-semibold text-ink-2">{t('trips.packages.preview.requirements')}</span>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-body text-ink-1">
          {requirements.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </div>
  )
}
