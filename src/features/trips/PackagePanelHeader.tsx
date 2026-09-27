import { X } from 'lucide-react'
import type { CargoPackage } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { PackageFigure } from './PackageFigure'
import { PackageStopMarker } from './PackageStopMarker'
import type { StopRow } from './trip-summary'

const CUBIC_CM_PER_LITER = 1000

/**
 * Đầu panel kiện V2.3 (`.phd`): hình kiện có đường kích thước, "Kiện PKG-001", tên kiện (Archivo), điểm giao, tổng khối lượng và thể
 * tích một kiện. Số tính từ giá trị đang nhập khi hợp lệ, nên hình và số đổi theo form; kiện mới chưa có kích thước thì chưa có hình.
 */
export function PackagePanelHeader({ pkg, stop, title, onClose }: {
  pkg: CargoPackage
  stop: StopRow | undefined
  /** Tiêu đề khi kiện chưa có tên (kiện mới). */
  title: string
  onClose: () => void
}) {
  const t = useT()
  const format = useFormat()
  const hasSize = pkg.lengthCm > 0 && pkg.widthCm > 0 && pkg.heightCm > 0
  const stats = [
    { label: t('trips.packages.preview.totalWeight'), value: format.weight(pkg.weightKg * pkg.quantity) },
    {
      label: t('trips.packages.preview.volumeEach'),
      value: t('trips.packages.preview.liters', { value: format.decimal((pkg.lengthCm * pkg.widthCm * pkg.heightCm) / CUBIC_CM_PER_LITER) }),
    },
  ]

  return (
    <div className="flex flex-none items-start gap-3 border-b border-line-soft py-3.5 pr-2.5 pl-3">
      {hasSize ? (
        <PackageFigure lengthCm={pkg.lengthCm} widthCm={pkg.widthCm} heightCm={pkg.heightCm} deliveryStop={pkg.deliveryStop} />
      ) : null}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center gap-2 text-fine text-ink-3">
          {t('trips.form.code')}
          <span className="font-mono text-ink-2">{pkg.id}</span>
          <button
            type="button"
            aria-label={t('trips.form.close')}
            onClick={onClose}
            className="-my-2 ml-auto grid size-8.5 flex-none place-items-center rounded-md text-ink-3 transition-colors duration-(--dur-fast) ease-standard hover:bg-surface hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:size-12"
          >
            <X className="size-4.5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <h2 className="mt-1 font-display text-h3 leading-5.25 font-[650] text-ink-strong font-stretch-104%">{pkg.name || title}</h2>
        {stop ? (
          <p className="mt-1.5 flex min-w-0 items-center gap-2 text-small text-ink-2">
            <PackageStopMarker number={stop.number} size="sm" />
            <span className="sr-only">{t('trips.packages.columns.stop')} {stop.number}: </span>
            <span className="truncate">{stop.name}</span>
          </p>
        ) : null}
        {hasSize ? (
          <dl className="m-0 mt-2.25 flex gap-4.5">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-px">
                <dt className="text-note leading-3.75 text-ink-3">{stat.label}</dt>
                <dd className="m-0 font-display text-small font-[650] text-ink-strong tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  )
}
