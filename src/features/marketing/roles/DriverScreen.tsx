import { useFormat, useT } from '@/lib/i18n'
import { DeviceFrame } from './DeviceFrame'
import type { RoleCargo, RoleRoute } from './roles-model'
import { MiniCard, MiniDeadline, MiniPrimary, MiniStop, Screen, ScreenBar } from './screen-parts'

/**
 * Tab tài xế: màn điểm giao thu nhỏ trên điện thoại — điểm xe đang tới (cùng điểm với màn Giám sát), giờ đến dự kiến và hạn giao kèm
 * chip mức hạn, số kiện cần dỡ với ba kiện đầu (mã instance của chuyến mẫu), và nút chính của bước: chưa tới điểm thì là "Đã đến điểm n".
 */
export function DriverScreen({ route, cargo }: { route: RoleRoute; cargo: RoleCargo }) {
  const t = useT()
  const format = useFormat()
  const stop = route.stops[route.headingTo - 1] ?? route.stops[0]
  if (!stop) throw new Error('Tuyến mẫu không có điểm giao')
  const line = cargo.lines.find((item) => item.stop === stop.number) ?? cargo.firstStopLine
  const ids = stop.number === cargo.firstStopLine.stop ? cargo.firstStopIds : []
  const name = t(`landing.sample.stop${stop.number as 1 | 2 | 3 | 4}`)
  const status = t(`common.deadlineStatuses.${stop.status}`)
  const action = t('driver.arrive', { number: stop.number })
  return (
    <>
      <DeviceFrame device="phone">
        <Screen device="phone">
          <ScreenBar title={t('driver.stopTitle', { number: stop.number, total: route.stops.length })} logo={false} className="h-[4em] pt-[1.3em]" />
          <div className="flex min-h-0 flex-1 flex-col gap-[0.6em] p-[0.8em]">
            <MiniCard className="flex flex-col gap-[0.4em] p-[0.8em]">
              <span className="flex items-center gap-[0.5em] font-display text-[1.1em] font-bold text-ink-strong font-stretch-108%">
                <MiniStop stop={stop.number} className="text-[0.9em]" />
                {name}
              </span>
              <span className="flex items-baseline justify-between text-[0.9em] text-ink-2">
                {t('driver.timing.expected')}
                <span className="font-mono font-semibold text-ink-strong tabular-nums">{format.time(stop.eta)}</span>
              </span>
              <span className="flex items-baseline justify-between text-[0.9em] text-ink-2">
                {t('driver.timing.deadline')}
                <span className="font-mono font-semibold text-ink-strong tabular-nums">{format.time(stop.deadline)}</span>
              </span>
              <span><MiniDeadline status={stop.status}>{status}</MiniDeadline></span>
            </MiniCard>
            <span className="text-[0.9em] font-semibold text-ink-2">{t('landingRoles.frame.toUnload', { count: line.quantity })}</span>
            <MiniCard className="flex flex-col">
              {ids.map((id) => (
                <span key={id} className="flex items-baseline justify-between gap-[0.4em] border-b border-line-soft px-[0.7em] py-[0.5em] last:border-b-0">
                  <span className="font-mono text-[0.9em] font-semibold text-ink-strong">{id}</span>
                  <span className="font-mono text-[0.75em] text-ink-3 tabular-nums">{format.weight(line.weightKg)}</span>
                </span>
              ))}
            </MiniCard>
            <MiniPrimary className="mt-auto h-[3em]">{action}</MiniPrimary>
          </div>
        </Screen>
      </DeviceFrame>
      <p className="sr-only">
        {t('landingRoles.text.driver', {
          number: stop.number,
          total: route.stops.length,
          name,
          eta: format.time(stop.eta),
          deadline: format.time(stop.deadline),
          status,
          count: line.quantity,
          action,
        })}
      </p>
    </>
  )
}
