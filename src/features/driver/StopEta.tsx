import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import { stopTiming } from './stop-timing'
import { EtaSourceLine, Time, TimingChip, useMoment } from './StopTimingParts'
import { useDriverTripMonitoringQuery } from './useDriverQueries'

/**
 * Giờ đến và hạn giao của điểm đang giao, trong thẻ liên hệ (FE-6-09). Chưa đến: "Dự kiến đến" — đang vận chuyển thì tính từ vị trí xe
 * (mô phỏng hoặc GPS thật, đọc lại theo nhịp kho trả), không thì theo tuyến đã tối ưu — kèm nguồn và MOCK RESULT (giờ đến là ước lượng của
 * mock), mức hạn bằng chữ cạnh hạn. Đã đến: giờ đến thật và "Đến kịp hạn" / "Đến trễ hạn". Chuyến chưa tối ưu tuyến thì không có dòng giờ
 * đến; điểm không có hạn ghi "Không có hạn". Giờ kèm ngày khi không phải hôm nay. Không phải vùng thông báo: giờ đổi theo nhịp mà trình
 * đọc màn hình không phải đọc lại. Cách viết giờ, chip và dòng nguồn dùng chung với hai danh sách điểm (`StopTimingParts`).
 */
export function StopEta({ trip, stopNumber, arrivedAt, delivering }: {
  trip: Pick<Trip, 'id' | 'stops' | 'routePlan'>
  stopNumber: number
  arrivedAt: string | undefined
  /** Chuyến Đang vận chuyển: giờ đến dự kiến tính từ vị trí xe. */
  delivering: boolean
}) {
  const t = useT()
  const moment = useMoment()
  const live = useDriverTripMonitoringQuery(trip.id, delivering && arrivedAt === undefined && trip.routePlan !== undefined)
  const timing = stopTiming(trip, stopNumber, arrivedAt, delivering ? live.data : undefined)
  const { deadline, arrival, expected } = timing

  return (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        {arrival ? <Fact label={t('driver.timing.arrived')}><Time>{moment(arrival.at)}</Time></Fact> : null}
        {!arrival && expected ? <Fact label={t('driver.timing.expected')}><Time>{moment(expected.eta)}</Time></Fact> : null}
        <Fact label={t('driver.timing.deadline')}>
          {deadline ? <Time>{moment(deadline)}</Time> : <span className="text-ink-2">{t('driver.timing.noDeadline')}</span>}
          <TimingChip timing={timing} />
        </Fact>
      </dl>
      <EtaSourceLine sources={!arrival && expected ? [expected.source] : []} />
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
