import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { useFormat, useT } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import { SectionNumber, TripFormSection } from './TripFormSection'

/**
 * Mục 3 "Hàng hoá" của form chuyến (V2.3). Tạo mới: dải chú thích cuối card — kiện thêm ở Chi tiết chuyến sau khi tạo. Sửa: số dòng
 * kiện và số kiện của chuyến đã lưu, liên kết tới danh sách kiện; kho đang xếp thì thêm tiến độ xếp theo phương án đã duyệt và nhãn
 * "Đã khoá".
 */
export function TripFormCargoSection({ existing, locked }: { existing: Trip | undefined; locked: boolean }) {
  const t = useT()
  const format = useFormat()
  if (!existing) {
    return (
      <div className="flex items-center gap-3 border-t border-line-soft bg-n-25 px-7 py-4 text-lede text-ink-2 max-sm:px-4">
        <SectionNumber number={3} muted />
        <p>
          <span className="mr-1.5 font-semibold text-ink-strong">{t('trips.create.cargoTitle')}</span>
          {t('trips.create.cargoLater')}
        </p>
      </div>
    )
  }
  const instances = existing.packages.reduce((sum, pkg) => sum + pkg.quantity, 0)
  const loading = existing.loading
  const loaded = loading?.steps.filter((step) => step.outcome === 'loaded').length ?? 0
  return (
    <TripFormSection number={3} title={t('trips.create.cargoTitle')} locked={locked}>
      <div className="flex flex-wrap items-center gap-4 rounded-[12px] border border-border px-4.5 py-3.5">
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink-strong">
            {t('trips.create.cargoLines', { count: existing.packages.length, instances: format.integer(instances) })}
          </p>
          <p className="mt-0.5 text-small text-ink-3">
            {loading ? (
              <>
                {t('trips.create.cargoLoaded', { loaded: format.integer(loaded), total: format.integer(instances) })}{' '}
                <span className="font-mono text-caption">{loading.revisionId}</span>
              </>
            ) : t('trips.create.cargoHint')}
          </p>
        </div>
        <Link
          to={`/chuyen/${existing.id}`}
          className="ml-auto inline-flex items-center gap-1 rounded-sm text-body font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('trips.create.openCargo')}
          <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
        </Link>
      </div>
    </TripFormSection>
  )
}
