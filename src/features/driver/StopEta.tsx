import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { DeadlineStatus } from '@/domain/routing'
import { useFormat, useT } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import { stopTiming } from './stop-timing'
import { useDriverTripMonitoringQuery } from './useDriverQueries'

const DEADLINE_TONE: Readonly<Record<DeadlineStatus, BadgeTone>> = { OK: 'success', AT_RISK: 'warning', MISSED: 'danger' }

/** Chip và nhãn trên màn cảm ứng phóng lên 16 px (mục 5, chip trạng thái). */
const TOUCH_CHIP = 'h-8 px-3 text-body-lg'

/**
 * Giờ đến và hạn giao của điểm đang giao, trong thẻ liên hệ (FE-6-09). Chưa đến: "Dự kiến đến" — đang vận chuyển thì tính từ vị trí xe
 * (mô phỏng hoặc GPS thật, đọc lại theo nhịp kho trả), không thì theo tuyến đã tối ưu — kèm nguồn và MOCK RESULT (giờ đến là ước lượng của
 * mock), mức hạn bằng chữ cạnh hạn. Đã đến: giờ đến thật và "Đến kịp hạn" / "Đến trễ hạn". Chuyến chưa tối ưu tuyến thì không có dòng giờ
 * đến; điểm không có hạn ghi "Không có hạn". Giờ kèm ngày khi không phải hôm nay. Không phải vùng thông báo: giờ đổi theo nhịp mà trình
 * đọc màn hình không phải đọc lại.
 */
export function StopEta({ trip, stopNumber, arrivedAt, delivering }: {
  trip: Pick<Trip, 'id' | 'stops' | 'routePlan'>
  stopNumber: number
  arrivedAt: string | undefined
  /** Chuyến Đang vận chuyển: giờ đến dự kiến tính từ vị trí xe. */
  delivering: boolean
}) {
  const t = useT()
  const format = useFormat()
  const live = useDriverTripMonitoringQuery(trip.id, delivering && arrivedAt === undefined && trip.routePlan !== undefined)
  const { deadline, arrival, expected } = stopTiming(trip, stopNumber, arrivedAt, delivering ? live.data : undefined)
  const moment = (iso: string) =>
    format.date(iso) === format.date(new Date()) ? format.time(iso) : t('driver.timing.dated', { time: format.time(iso), date: format.dayMonth(iso) })

  const deadlineChip = arrival
    ? arrival.onTime === null ? null : (
        <Badge tone={arrival.onTime ? 'success' : 'danger'} dot className={TOUCH_CHIP}>
          {t(arrival.onTime ? 'common.arrivalStatuses.onTime' : 'common.arrivalStatuses.late')}
        </Badge>
      )
    : expected?.status === undefined ? null : (
        <Badge tone={DEADLINE_TONE[expected.status]} dot={expected.status === 'OK' ? 'solid' : 'halo'} className={TOUCH_CHIP}>
          {t(`common.deadlineStatuses.${expected.status}`)}
        </Badge>
      )

  return (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        {arrival ? <Fact label={t('driver.timing.arrived')}><Time>{moment(arrival.at)}</Time></Fact> : null}
        {!arrival && expected ? <Fact label={t('driver.timing.expected')}><Time>{moment(expected.eta)}</Time></Fact> : null}
        <Fact label={t('driver.timing.deadline')}>
          {deadline ? <Time>{moment(deadline)}</Time> : <span className="text-ink-2">{t('driver.timing.noDeadline')}</span>}
          {deadlineChip}
        </Fact>
      </dl>
      {!arrival && expected ? (
        <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-3">
          {t(`driver.timing.sources.${expected.source}`)}
          <Badge shape="tag" tone="mock" className={TOUCH_CHIP}>MOCK RESULT</Badge>
        </p>
      ) : null}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{children}</dd>
    </>
  )
}

function Time({ children }: { children: ReactNode }) {
  return <span className="font-mono font-semibold text-ink-strong tabular-nums">{children}</span>
}
