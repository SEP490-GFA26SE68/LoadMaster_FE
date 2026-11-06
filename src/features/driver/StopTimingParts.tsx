import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { DeadlineStatus } from '@/domain/routing'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { EtaSource, StopTiming } from './stop-timing'

/*
 * Phần dùng chung của giờ đến và hạn giao trên màn tài xế (FE-6-09): thẻ liên hệ của điểm đang giao (`StopEta`) và dòng giờ của từng điểm ở
 * hai danh sách điểm (`MyTripStops`, `DriverStopList`) — một cách viết giờ, một bộ chip mức hạn, một dòng nguồn kèm MOCK RESULT.
 */

const DEADLINE_TONE: Readonly<Record<DeadlineStatus, BadgeTone>> = { OK: 'success', AT_RISK: 'warning', MISSED: 'danger' }

/** Chip và nhãn trên màn cảm ứng phóng lên 16 px (mục 5, chip trạng thái). */
const TOUCH_CHIP = 'h-8 px-3 text-body-lg'

/** Viết một mốc giờ: chỉ giờ khi là hôm nay, kèm ngày khi không phải ("09:40 · 17/09"). */
export function useMoment(): (iso: string) => string {
  const t = useT()
  const format = useFormat()
  return (iso) =>
    format.date(iso) === format.date(new Date()) ? format.time(iso) : t('driver.timing.dated', { time: format.time(iso), date: format.dayMonth(iso) })
}

/** Giờ bằng chữ số cùng bề rộng. */
export function Time({ children }: { children: ReactNode }) {
  return <span className="font-mono font-semibold text-ink-strong tabular-nums">{children}</span>
}

/**
 * Mức hạn bằng chữ, chỉ khi điểm có hạn: đã đến thì "Đến kịp hạn" / "Đến trễ hạn" theo giờ đến thật, chưa đến thì mức hạn của giờ đến dự
 * kiến (Kịp hạn · Sát hạn · Trễ hạn dự kiến). Màu luôn đi kèm chữ.
 */
export function TimingChip({ timing }: { timing: Pick<StopTiming, 'arrival' | 'expected'> }) {
  const t = useT()
  const { arrival, expected } = timing
  if (arrival) {
    if (arrival.onTime === null) return null
    return (
      <Badge tone={arrival.onTime ? 'success' : 'danger'} dot className={TOUCH_CHIP}>
        {t(arrival.onTime ? 'common.arrivalStatuses.onTime' : 'common.arrivalStatuses.late')}
      </Badge>
    )
  }
  if (expected?.status === undefined) return null
  return (
    <Badge tone={DEADLINE_TONE[expected.status]} dot={expected.status === 'OK' ? 'solid' : 'halo'} className={TOUCH_CHIP}>
      {t(`common.deadlineStatuses.${expected.status}`)}
    </Badge>
  )
}

/**
 * Nguồn của giờ đến dự kiến kèm MOCK RESULT (giờ đến là ước lượng của mock): một dòng cho cả thẻ hay cả danh sách. Không có giờ dự kiến nào
 * thì không có dòng.
 */
export function EtaSourceLine({ sources, className }: { sources: readonly EtaSource[]; className?: string }) {
  const t = useT()
  const format = useFormat()
  if (sources.length === 0) return null
  return (
    <p className={cn('m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-3', className)}>
      {format.list(sources.map((source) => t(`driver.timing.sources.${source}`)))}
      <Badge shape="tag" tone="mock" className={TOUCH_CHIP}>MOCK RESULT</Badge>
    </p>
  )
}

/**
 * Dòng giờ của một điểm trong danh sách điểm: "Dự kiến 08:15" (chưa đến) hoặc "Đã đến 08:50", kèm chip mức hạn khi điểm có hạn. Chip
 * xuống dòng riêng khi hết chỗ (điện thoại 360 px).
 */
export function StopListTime({ timing, className }: { timing: StopTiming; className?: string }) {
  const t = useT()
  const moment = useMoment()
  const at = timing.arrival?.at ?? timing.expected?.eta
  if (at === undefined) return null
  return (
    <p className={cn('m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-lg', className)}>
      <span className="text-ink-2">
        {t(timing.arrival ? 'driver.timing.arrived' : 'driver.timing.expectedShort')} <Time>{moment(at)}</Time>
      </span>
      <TimingChip timing={timing} />
    </p>
  )
}
