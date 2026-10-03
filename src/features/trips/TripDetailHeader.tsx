import { Box, Info, Lock, Play } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHero } from '@/components/PageHero'
import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { useFormat, useT } from '@/lib/i18n'
import { vnClock } from '@/lib/mock-db'
import { plannerPath } from '@/lib/planner-path'
import { dateOnly } from './trip-dates'
import { TripActionsMenu } from './TripActionsMenu'
import { TripDetailBanner } from './TripDetailBanner'
import { TripDetailStepper } from './TripDetailStepper'
import type { TripDetail } from './trips-api'

/**
 * Dải trời của Chi tiết chuyến (V2.3 `ChiTietChuyen*.jpg`, LM-088, LM-103): đường dẫn "Chuyến hàng / mã", tên chuyến và chip trạng
 * thái, dòng ngày chạy · xe · tài xế; phải là menu thao tác, "Chạy tối ưu", "Xem phương án 3D". Quyết định 1: chuyến đã có phương án
 * có cả hai nút — chính "Xem phương án 3D", phụ (kính) "Chạy tối ưu"; chuyến nháp chỉ "Chạy tối ưu" là nút chính (một nút chính mỗi
 * màn). Hành động bị chặn hoặc pha chỉ xem nói lý do ngay dưới nút. Trong dải: tiến trình rồi banner theo pha; card sơ đồ tuyến đè
 * lên đáy dải (`overlap`).
 */
export function TripDetailHeader({ tripId, detail }: { tripId: string; detail: TripDetail | undefined }) {
  const t = useT()
  const can = useCan()
  const [searchParams] = useSearchParams()
  const hintId = useId()
  const trip = detail?.trip
  const runnable = trip?.phase === 'planning' && can('optimization.run')
  const plan = can('plans.view') ? detail?.plan : null
  const optimizePath = `/chuyen/${tripId}/toi-uu${searchParams.get('mo-phong') === 'loi' ? '?mo-phong=loi' : ''}`
  const blocked = runnable && !plan && trip.packages.length === 0
  const hint = blocked
    ? { icon: Info, text: t('trips.detail.runBlocked.noPackages') }
    : trip?.phase === 'delivering' || trip?.phase === 'completed'
      ? { icon: Lock, text: t(`trips.detail.locked.${trip.phase}`) }
      : null

  const run = runnable ? (
    blocked ? (
      <Button variant="primary" disabled aria-describedby={hintId}><Play strokeWidth={1.5} />{t('trips.detail.runOptimization')}</Button>
    ) : (
      <Button variant={plan ? 'glass' : 'primary'} asChild>
        <Link to={optimizePath}><Play strokeWidth={1.5} />{t('trips.detail.runOptimization')}</Link>
      </Button>
    )
  ) : null

  return (
    <PageHero
      overlap
      crumbs={[{ label: t('trips.list.title'), to: '/chuyen' }, { label: tripId, mono: true }]}
      title={trip?.name ?? tripId}
      badge={detail ? (
        <span className="flex items-center gap-2">
          <StatusBadge status={detail.status} />
          <TripSubStatusTag sub={detail.sub} />
          <TripSubStatusTag sub={detail.extraSub} />
        </span>
      ) : undefined}
      description={detail ? <TripMeta detail={detail} /> : undefined}
      actions={
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2.5">
            {trip && can('trips.edit') ? <TripActionsMenu trip={trip} /> : null}
            {run}
            {plan ? (
              <Button variant="primary" asChild>
                <Link to={plannerPath({ tripId, jobId: plan.jobId, revisionId: plan.revisionId })}>
                  <Box strokeWidth={1.5} />
                  {t('trips.detail.openPlan')}
                </Link>
              </Button>
            ) : null}
          </div>
          {hint ? (
            <p id={hintId} className="m-0 flex items-center gap-1.5 text-fine whitespace-nowrap text-sky-text-3">
              <hint.icon aria-hidden className="size-3.5 flex-none" strokeWidth={1.75} />
              {hint.text}
            </p>
          ) : null}
        </div>
      }
    >
      {trip ? (
        <div className="flex flex-col gap-4 px-5 pt-2 pb-5">
          <TripDetailStepper trip={trip} />
          <TripDetailBanner trip={trip} />
        </div>
      ) : null}
    </PageHero>
  )
}

/** "Ngày chạy 24/09/2026, xuất phát 08:00 · Hyundai HD210 60C-446.32 · Tài xế Phạm Quốc Dũng" — giá trị chữ trắng, biển số mono. Giờ theo giờ Việt Nam. */
function TripMeta({ detail }: { detail: TripDetail }) {
  const t = useT()
  const format = useFormat()
  const { trip, vehicle, driver } = detail
  const cut = vehicle.name.lastIndexOf(' · ')
  const value = (children: ReactNode) => <b className="font-semibold text-sky-text">{children}</b>
  return (
    <span className="inline-flex min-w-0 items-baseline gap-3">
      <span>
        {t('trips.detail.runDate')} {value(format.date(dateOnly(trip.scheduledDate)))}
        {t('trips.detail.departsAt')} {value(vnClock(new Date(trip.departureAt)))}
      </span>
      <span aria-hidden>·</span>
      <span>
        {cut === -1 ? vehicle.name : <>{vehicle.name.slice(0, cut)} <span className="font-mono text-caption text-cyan-200">{vehicle.name.slice(cut + 3)}</span></>}
      </span>
      <span aria-hidden>·</span>
      <span>{trip.driverId === null ? t('trips.detail.noDriver') : <>{t('trips.detail.driver')} {value(driver?.fullName ?? trip.driverId)}</>}</span>
    </span>
  )
}
