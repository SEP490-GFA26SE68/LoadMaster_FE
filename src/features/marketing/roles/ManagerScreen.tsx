import { useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { DeviceFrame } from './DeviceFrame'
import type { RoleCargo } from './roles-model'
import { MiniCard, Screen, ScreenBar } from './screen-parts'

/** Biểu đồ cột trong hộp 100 × 42 (co vừa ô chứa, không tràn lên tiêu đề): cột cao nhất 25 đơn vị, chân cột ở y = 31, số điểm giao bên dưới. */
const CHART = { base: 31, top: 6, bar: 11 } as const

/**
 * Biểu đồ cột theo luật biểu đồ 2D (mục 5): một chuỗi một màu `--primary`, lưới `--border`, số trên đầu cột; trục là số điểm giao trên
 * màu định danh — màu chỉ để định danh điểm giao, luôn kèm số.
 */
function WeightChart({ cargo }: { cargo: RoleCargo }) {
  const format = useFormat()
  const max = Math.max(...cargo.lines.map((line) => line.totalKg))
  const step = 100 / cargo.lines.length
  return (
    <svg viewBox="0 0 100 42" className="absolute inset-0 block size-full" preserveAspectRatio="xMidYMax meet">
      <line x1={2} x2={98} y1={CHART.base} y2={CHART.base} className="stroke-border" strokeWidth={0.3} />
      <line x1={2} x2={98} y1={CHART.top} y2={CHART.top} className="stroke-line-soft" strokeWidth={0.3} />
      {cargo.lines.map((line, index) => {
        const height = (line.totalKg / max) * (CHART.base - CHART.top)
        const x = index * step + (step - CHART.bar) / 2
        const mid = x + CHART.bar / 2
        return (
          <g key={line.id}>
            <path
              d={`M${x},${CHART.base} V${CHART.base - height + 1} Q${x},${CHART.base - height} ${x + 1},${CHART.base - height} H${x + CHART.bar - 1} Q${x + CHART.bar},${CHART.base - height} ${x + CHART.bar},${CHART.base - height + 1} V${CHART.base} Z`}
              className="fill-primary"
            />
            <text x={mid} y={CHART.base - height - 1.4} textAnchor="middle" fontSize={3.2} className="fill-ink-2 font-mono tabular-nums">
              {format.integer(line.totalKg)}
            </text>
            <circle cx={mid} cy={CHART.base + 5} r={2.8} fill={stopColor(line.stop)} />
            <text x={mid} y={CHART.base + 5} dy="0.36em" textAnchor="middle" fontSize={3.2} fill={stopForeground(line.stop)} className="font-display font-bold">
              {line.stop}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Tab quản lý công ty: bảng điều khiển thu nhỏ trên máy tính — bốn ô số liệu và biểu đồ khối lượng theo điểm giao. Mọi số đếm thẳng từ
 * chuyến mẫu (`roleCargo`), không số so với kỳ trước.
 */
export function ManagerScreen({ cargo }: { cargo: RoleCargo }) {
  const t = useT()
  const format = useFormat()
  const kpis = [
    { key: 'packages', value: format.integer(cargo.packageCount) },
    { key: 'stops', value: format.integer(cargo.stopCount) },
    { key: 'weight', value: format.weight(cargo.totalKg) },
    { key: 'payload', value: format.percent(cargo.payloadRatio * 100) },
  ] as const
  return (
    <>
      <DeviceFrame device="laptop">
        <Screen device="laptop">
          <ScreenBar title={t('nav.dashboard')} className="h-[2.6em]" />
          <div className="flex min-h-0 flex-1 flex-col gap-[0.8em] p-[0.9em]">
            <div className="grid grid-cols-4 gap-[0.7em]">
              {kpis.map(({ key, value }) => (
                <MiniCard key={key} className="flex flex-col gap-[0.35em] px-[0.8em] py-[0.7em]">
                  <span className="text-[0.82em] text-ink-2">{t(`landingRoles.frame.kpi.${key}`)}</span>
                  <span className="font-display text-[1.55em] leading-none font-bold whitespace-nowrap text-ink-strong tabular-nums">{value}</span>
                </MiniCard>
              ))}
            </div>
            <MiniCard className="flex min-h-0 flex-1 flex-col px-[0.9em] py-[0.7em]">
              <span className="font-display text-[0.95em] font-bold text-ink-strong font-stretch-108%">{t('landingRoles.frame.chart')}</span>
              <div className="relative mt-[0.4em] min-h-0 flex-1">
                <WeightChart cargo={cargo} />
              </div>
            </MiniCard>
          </div>
        </Screen>
      </DeviceFrame>
      <div className="sr-only">
        <p>
          {t('landingRoles.text.companyManager', {
            packages: format.integer(cargo.packageCount),
            stops: format.integer(cargo.stopCount),
            weight: format.weight(cargo.totalKg),
            percent: format.percent(cargo.payloadRatio * 100),
          })}
        </p>
        <ul>
          {cargo.lines.map((line) => (
            <li key={line.id}>
              {t('landingRoles.text.stopWeight', {
                number: line.stop,
                name: t(`landing.sample.stop${line.stop as 1 | 2 | 3 | 4}`),
                weight: format.weight(line.totalKg),
              })}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
