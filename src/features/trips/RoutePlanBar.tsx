import { Route } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Formatter } from '@/lib/format'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import type { TripEta } from '@/lib/mock-db'
import { useOptimizeRouteMutation } from './useRouteQuery'

/** "3 giờ 20 phút" · "45 phút" — thời gian cả tuyến, phút nguyên. */
function durationLabel(totalMinutes: number, t: TFunction, format: Formatter): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = format.integer(totalMinutes % 60)
  return hours === 0 ? t('trips.routePlan.minutes', { minutes }) : t('trips.routePlan.duration', { hours: format.integer(hours), minutes })
}

/**
 * Đầu card sơ đồ tuyến (FE-4b-09, D-76): tuyến đã tối ưu thì hiện nhãn **MOCK RESULT**, quãng đường và thời gian ước lượng, số điểm
 * trễ hạn dự kiến; chưa tối ưu thì một câu nói còn thiếu gì. Nút "Tối ưu tuyến" (nút phụ — nút chính của màn là tối ưu xếp hàng) chỉ
 * có khi người xem có quyền `routes.optimize` và chuyến còn lập kế hoạch. Kho từ chối (điểm chưa có toạ độ…) thì câu lỗi hiện ngay
 * dưới thanh, chỉ đúng điểm.
 */
export function RoutePlanBar({ tripId, eta, stopCount, canOptimize }: {
  tripId: string
  /** `null` khi chuyến chưa tối ưu tuyến; `undefined` khi đang tải. */
  eta: TripEta | null | undefined
  stopCount: number
  canOptimize: boolean
}) {
  const t = useT()
  const format = useFormat()
  const optimize = useOptimizeRouteMutation(tripId)
  const late = eta?.missedStopIds.length ?? 0

  function handleOptimize() {
    optimize.mutate(undefined, { onSuccess: (trip) => toast.success(t('trips.routePlan.done', { count: trip.stops.length })) })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-4.5 py-2.5">
      {eta ? (
        <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5 text-small text-ink-2">
          <span className="font-semibold text-ink-strong">{t('trips.routePlan.optimized')}</span>
          {eta.isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
          <span className="tabular-nums">{t('trips.routePlan.summary', { km: format.decimal(eta.totalKm), duration: durationLabel(eta.totalMinutes, t, format) })}</span>
          {late > 0 ? <Badge shape="tag" tone="danger">{t('trips.routePlan.late', { count: late })}</Badge> : null}
        </p>
      ) : (
        <p className="min-w-0 flex-1 basis-80 text-small text-ink-3">
          {eta === undefined ? null : t(stopCount === 0 ? 'trips.routePlan.noStops' : 'trips.routePlan.notOptimized')}
        </p>
      )}
      {canOptimize ? (
        <Button variant="secondary" size="sm" loading={optimize.isPending} disabled={stopCount === 0} onClick={handleOptimize}>
          <Route strokeWidth={1.75} />
          {t(eta ? 'trips.routePlan.optimizeAgain' : 'trips.routePlan.optimize')}
        </Button>
      ) : null}
      {eta ? <p className="basis-full text-note text-ink-3">{t(canOptimize ? 'trips.routePlan.basisEditable' : 'trips.routePlan.basis')}</p> : null}
      {optimize.isError ? <p role="alert" className="basis-full text-small text-danger">{dataErrorMessage(optimize.error, t)}</p> : null}
    </div>
  )
}
