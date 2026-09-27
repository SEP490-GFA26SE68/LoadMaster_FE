import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useFormat, useT } from '@/lib/i18n'
import type { SheetSample } from '../design-system-api'
import { SheetCard } from '../SheetLayout'

type RowKey = 'screenTitle' | 'bigNumber' | 'cardTitle' | 'body' | 'tableNumber' | 'code'

/** Biển số là phần sau " · " của tên xe trong kho ("Hyundai HD210 · 60C-446.32"). */
function plateOf(vehicleName: string) {
  const cut = vehicleName.lastIndexOf(' · ')
  return cut === -1 ? vehicleName : vehicleName.slice(cut + 3)
}

/**
 * Thang chữ V2.3 trên dữ liệu thật của chuyến đầu kho: tên chuyến, lấp đầy và khối lượng, một kiện, mã chuyến / kiện / biển số.
 * Câu thường và tiêu đề thẻ là chữ đang dùng ở màn Thiết lập tối ưu và Bảng điều khiển.
 */
export function TypeCard({ sample }: { sample: SheetSample | undefined }) {
  const t = useT()
  const format = useFormat()

  const samples: Record<RowKey, ReactNode> | null = sample
    ? {
        screenTitle: (
          <span className="font-display text-display leading-[1.1] font-bold tracking-[-0.5px] font-stretch-112%">{sample.trip.name}</span>
        ),
        bigNumber: (
          <span className="font-display text-[40px] leading-none font-bold tracking-[-1px] tabular-nums font-stretch-112%">
            {sample.trip.volumePercent === null ? t('designSystem.style.unread') : format.percent(sample.trip.volumePercent)}{' '}
            <span className="text-cyan-700">{format.weight(sample.trip.weightKg)}</span>
          </span>
        ),
        cardTitle: (
          <span className="font-display text-h3 leading-5.5 font-[650] font-stretch-106%">{t('manager.charts.vehicles.title')}</span>
        ),
        body: <span className="text-body">{t('optimization.lifoHint')}</span>,
        tableNumber: (
          <span className="font-mono text-body tabular-nums">
            {[format.weight(sample.trip.weightKg), format.weight(sample.pkg.weightKg),
              format.dimensions(sample.pkg.lengthCm, sample.pkg.widthCm, sample.pkg.heightCm)].join(' · ')}
          </span>
        ),
        code: (
          <span className="font-mono text-caption text-ink-2 tabular-nums">
            {[sample.trip.id, sample.pkg.id, plateOf(sample.trip.vehicleName)].join(' · ')}
          </span>
        ),
      }
    : null

  const rows: readonly RowKey[] = ['screenTitle', 'bigNumber', 'cardTitle', 'body', 'tableNumber', 'code']
  return (
    <SheetCard title={t('designSystem.style.type.title')} meta={t('designSystem.style.type.meta')} className="col-span-12 lg:col-span-8" bodyClassName="gap-0 py-2">
      <dl className="m-0">
        {rows.map((key) => (
          <div key={key} className="grid grid-cols-1 items-baseline gap-x-4 gap-y-1 border-b border-line-soft py-3 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)]">
            <dt className="flex flex-col text-fine text-ink-3">
              <span className="text-small font-semibold text-ink-strong">{t(`designSystem.style.type.${key}.name`)}</span>
              {t(`designSystem.style.type.${key}.spec`)}
            </dt>
            <dd className="m-0 min-w-0 text-ink-strong">{samples ? samples[key] : <Skeleton className="h-5 w-3/5" />}</dd>
          </div>
        ))}
      </dl>
    </SheetCard>
  )
}
