import type { CSSProperties } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { DeviceFrame } from './DeviceFrame'
import { hoursMinutes, type RoleRoute, type UnitPoint } from './roles-model'
import { MiniCard, MiniChip, MiniDeadline, MiniStop, Screen, ScreenBar } from './screen-parts'

/** Khung vẽ của sơ đồ tuyến: hộp 100 × 64, các điểm đã chiếu vào hộp đơn vị đặt trong phần lề này. */
const SKETCH = { width: 100, height: 64, left: 9, right: 91, top: 9, bottom: 55 } as const

function sketchPoint({ x, y }: UnitPoint): { x: number; y: number } {
  return {
    x: SKETCH.left + x * (SKETCH.right - SKETCH.left),
    y: SKETCH.top + y * (SKETCH.bottom - SKETCH.top),
  }
}

/**
 * Sơ đồ tuyến như bản đồ của Chi tiết chuyến khi không có nền: kho, đường nối thẳng theo thứ tự đi, điểm giao trên màu định danh kèm số,
 * xe ở vị trí mô phỏng (thang azure — đang chạy). Xe chạy một lần từ kho tới chỗ của nó khi phần hiện ra (`roles.css`).
 */
function RouteSketch({ route, depotLabel }: { route: RoleRoute; depotLabel: string }) {
  const depot = sketchPoint(route.depot)
  const vehicle = sketchPoint(route.vehicle)
  const stops = route.stops.map((stop) => ({ number: stop.number, ...sketchPoint(stop.at) }))
  const line = [depot, ...stops].map((point) => `${point.x},${point.y}`).join(' ')
  const from = { '--roles-from-x': `${depot.x - vehicle.x}px`, '--roles-from-y': `${depot.y - vehicle.y}px` } as CSSProperties
  return (
    <svg viewBox={`0 0 ${SKETCH.width} ${SKETCH.height}`} className="block h-auto w-full" preserveAspectRatio="xMidYMid meet">
      <polyline points={line} fill="none" className="stroke-cyan-200" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={line} fill="none" className="stroke-primary" strokeWidth={0.9} strokeDasharray="0.4 2.4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={depot.x - 3.4} y={depot.y - 3.4} width={6.8} height={6.8} rx={1.4} className="fill-panel-dark" />
      <rect x={depot.x - 1.1} y={depot.y - 1.1} width={2.2} height={2.2} rx={0.4} className="fill-cyan-300" />
      <text x={depot.x} y={depot.y + 7.4} textAnchor="middle" fontSize={3.4} className="fill-ink-2 font-semibold">{depotLabel}</text>
      {stops.map(({ number, x, y }) => (
        <g key={number}>
          <circle cx={x} cy={y} r={3.6} fill={stopColor(number)} className="stroke-bg" strokeWidth={0.7} />
          <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={3.8} fill={stopForeground(number)} className="font-display font-bold">{number}</text>
        </g>
      ))}
      <g className="roles-vehicle" style={from}>
        <circle cx={vehicle.x} cy={vehicle.y} r={4.4} className="fill-azure-500" opacity={0.22} />
        <circle cx={vehicle.x} cy={vehicle.y} r={2.4} className="fill-azure-500 stroke-bg" strokeWidth={0.8} />
      </g>
    </svg>
  )
}

/**
 * Tab điều phối viên: màn Giám sát thu nhỏ trên máy tính — thẻ chuyến (trạng thái, điểm xe đang tới, nguồn vị trí "Mô phỏng", từng điểm
 * với giờ đến dự kiến, hạn và chip mức hạn) cạnh sơ đồ tuyến và dòng quãng đường · thời gian · giờ nghỉ bắt buộc. Mọi số là kết quả
 * `@/domain/routing` trên tuyến mẫu (`roleRoute`). Kèm bản chữ tương đương cho trình đọc màn hình.
 */
export function DispatcherScreen({ route }: { route: RoleRoute }) {
  const t = useT()
  const format = useFormat()
  const name = (number: number) => t(`landing.sample.stop${number as 1 | 2 | 3 | 4}`)
  const total = hoursMinutes(route.totalMinutes)
  const duration = total.hours > 0 ? t('trips.routePlan.duration', total) : t('trips.routePlan.minutes', { minutes: total.minutes })
  const summary = t('trips.routePlan.summary', { km: format.decimal(route.totalKm), duration })
  const rests = route.restCount > 0
    ? t('trips.routePlan.rests', { count: route.restCount, duration: t('trips.routePlan.minutes', { minutes: route.restMinutes }) })
    : null
  return (
    <>
      <DeviceFrame device="laptop">
        <Screen device="laptop">
          <ScreenBar title={t('monitoring.title')} className="h-[2.6em]" />
          <div className="grid min-h-0 flex-1 grid-cols-[19em_minmax(0,1fr)] gap-[0.8em] p-[0.9em]">
            <MiniCard className="flex min-h-0 flex-col px-[0.8em] py-[0.7em]">
              <div className="flex items-center justify-between gap-[0.5em]">
                <span className="font-display font-bold text-ink-strong font-stretch-108%">{t('landingRoles.frame.trip')}</span>
                <MiniChip className="bg-badge-azure-bg text-badge-azure-fg [--dot:var(--azure-500)]" dot="halo">{t('status.IN_TRANSIT')}</MiniChip>
              </div>
              <div className="mt-[0.4em] flex items-center gap-[0.5em] text-[0.85em] text-ink-2">
                {t('landingRoles.frame.headingTo', { number: route.headingTo })}
                <span className="rounded-[0.35em] border border-border px-[0.45em] py-[0.15em] text-[0.9em] font-semibold text-ink-2">
                  {t('monitoring.location.sources.SIMULATED')}
                </span>
              </div>
              <ul className="m-0 mt-[0.4em] flex list-none flex-col p-0">
                {route.stops.map((stop) => (
                  <li key={stop.number} className="flex items-start gap-[0.55em] border-t border-line-soft py-[0.38em]">
                    <MiniStop stop={stop.number} className="mt-[0.1em]" />
                    <span className="flex min-w-0 flex-col items-start gap-[0.2em]">
                      <span className="text-[0.95em] font-semibold text-ink-strong">{name(stop.number)}</span>
                      <span className="text-[0.82em] text-ink-3 tabular-nums">
                        {t('landingRoles.frame.stopTimes', { eta: format.time(stop.eta), deadline: format.time(stop.deadline) })}
                      </span>
                      <MiniDeadline status={stop.status}>{t(`common.deadlineStatuses.${stop.status}`)}</MiniDeadline>
                    </span>
                  </li>
                ))}
              </ul>
            </MiniCard>
            <MiniCard className="flex min-h-0 flex-col justify-between overflow-hidden">
              <div className="min-h-0 flex-1 bg-surface p-[0.4em]">
                <RouteSketch route={route} depotLabel={t('landingRoles.frame.depot')} />
              </div>
              <div className="border-t border-line-soft px-[0.8em] py-[0.6em] text-[0.85em] text-ink-2 tabular-nums">
                <span className="font-semibold text-ink-strong">{summary}</span>
                {rests ? <span className="block">{rests}</span> : null}
              </div>
            </MiniCard>
          </div>
        </Screen>
      </DeviceFrame>
      <div className="sr-only">
        <p>{t('landingRoles.text.dispatcher', { count: route.stops.length, number: route.headingTo, summary: rests ? `${summary}, ${rests}` : summary })}</p>
        <ul>
          {route.stops.map((stop) => (
            <li key={stop.number}>
              {t('landingRoles.text.stop', {
                number: stop.number,
                name: name(stop.number),
                eta: format.time(stop.eta),
                deadline: format.time(stop.deadline),
                status: t(`common.deadlineStatuses.${stop.status}`),
              })}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
