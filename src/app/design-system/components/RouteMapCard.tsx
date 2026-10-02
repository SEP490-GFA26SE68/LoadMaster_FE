import { RouteMap } from '@/components/map'
import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import { SheetCard } from '../SheetLayout'
import { useRouteSampleQuery } from '../useRouteSampleQuery'

/**
 * Bản đồ tuyến (FE-4b-07): `RouteMap` với kho Long Bình và bốn điểm giao của chuyến mẫu, thứ tự do mock tối ưu tuyến của
 * `domain/routing` xếp (FE-4b-08) — nên mang MOCK RESULT. Chưa có màn nào dùng bản đồ; thẻ này là nơi xem nó chạy.
 */
export function RouteMapCard() {
  const t = useT()
  const format = useFormat()
  const sample = useRouteSampleQuery().data

  return (
    <SheetCard title={t('designSystem.components.routeMap.title')} meta={t('designSystem.components.routeMap.meta')}>
      {sample ? (
        <>
          <RouteMap label={t('designSystem.components.routeMap.label', { tripId: sample.tripId })} depot={sample.depot} stops={sample.stops} />
          <p className="m-0 flex flex-wrap items-center gap-2 text-small text-ink-2">
            <Badge shape="tag" tone="mock">MOCK RESULT</Badge>
            <span className="tabular-nums">
              {t('designSystem.components.routeMap.summary', {
                count: format.integer(sample.stops.length),
                km: format.decimal(sample.totalKm),
                minutes: format.integer(sample.totalMinutes),
              })}
            </span>
          </p>
        </>
      ) : (
        <div className="h-80 rounded-md bg-n-100" />
      )}
      <p className="m-0 text-small text-ink-3">{t('designSystem.components.routeMap.note')}</p>
    </SheetCard>
  )
}
