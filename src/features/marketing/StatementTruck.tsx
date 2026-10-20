import { useId, type CSSProperties } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LOAD_ORDER, STOP_FILL } from './steps/scene-kit'
import { TruckFrame, type TruckBody } from './steps/truck-side'

/** Thùng xe nhìn ngang trong khung 460 × 210: cabin bên trái, cửa sau bên phải. */
const VIEW = { width: 460, height: 210 }
const BODY: TruckBody = { left: 96, right: 404, top: 50, floor: 162 }
/** Ô hàng của bốn điểm giao, từ vách trước ra cửa sau; mỗi ô hai kiện chồng nhau. */
const SLOT = { first: 104, width: 66, step: 75 }
const UPPER = { y: 58, height: 46 }
const LOWER = { y: 108, height: 50 }
/** Vạch chỉ cửa trên nóc thùng; nhãn "Cửa sau" đứng ngay trên vạch. */
const TICK = { top: BODY.top - 14, bottom: BODY.top - 4 }

/** Vị trí trong khung hình theo phần trăm, để đặt chữ HTML đúng chỗ dù hình co giãn. */
function percent(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(3)}%`
}

/**
 * Hình của dải nguyên tắc xếp hàng (trang trí, `aria-hidden`): xe tải nhìn ngang, hàng của bốn điểm giao xếp 4 · 3 · 2 · 1 từ cabin ra cửa
 * sau — hàng giao sau nằm sâu, hàng giao trước sát cửa; số điểm giao trên từng khối, nhãn "Cửa sau" trên cửa. Chuyển động bật và trình duyệt
 * có view timeline: từng khối vào qua cửa sau theo nhịp cuộn của dải (`sections.css`, `lp-load`), điểm 4 trước, điểm 1 vào chỗ đúng lúc câu
 * sáng hẳn. Không thì hình tĩnh, đủ bốn khối. Nhãn cửa là chữ HTML đặt lên hình, không nằm trong SVG: hình co theo bề rộng (điện thoại còn
 * khoảng 70 %), chữ thì giữ cỡ của trang — 14 px, 16 px trên máy cảm ứng.
 */
export function StatementTruck({ motion, className }: { motion: boolean; className?: string }) {
  const t = useT()
  const clipId = `lp-statement-cargo-${useId().replace(/[^\w-]/g, '')}`
  const door = BODY.right
  return (
    <div aria-hidden className={cn('relative', className)}>
      <svg viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className="block h-auto w-full">
        <defs>
          <clipPath id={clipId}>
            <rect x={BODY.left} y={BODY.top} width={BODY.right - BODY.left} height={BODY.floor - BODY.top} />
          </clipPath>
        </defs>
        <TruckFrame body={BODY} tone="dark" groundTo={VIEW.width} />
        <path d={`M${door} ${BODY.top} H${BODY.left + 5} Q${BODY.left} ${BODY.top} ${BODY.left} ${BODY.top + 5} V${BODY.floor} H${door}`} className="fill-cyan-900 stroke-sky-text-3" strokeWidth={1.5} />
        {LOAD_ORDER.map((stop, order) => (
          <rect key={stop} x={SLOT.first + order * SLOT.step} y={UPPER.y} width={SLOT.width} height={LOWER.y + LOWER.height - UPPER.y} rx={4} fill="none" className="stroke-border-dark" strokeWidth={1.5} strokeDasharray="5 4" />
        ))}
        <g clipPath={`url(#${clipId})`}>
          {LOAD_ORDER.map((stop, order) => {
            const x = SLOT.first + order * SLOT.step
            const style = { '--q': (order / (LOAD_ORDER.length - 1)).toFixed(3), '--load-x': `${door - x}px` } as CSSProperties
            return (
              <g key={stop} data-stop={stop} className={motion ? 'lp-load' : undefined} style={motion ? style : undefined}>
                <rect x={x} y={UPPER.y} width={SLOT.width} height={UPPER.height} rx={4} className={cn(STOP_FILL[stop], 'stroke-cyan-950')} strokeWidth={1.5} />
                <rect x={x} y={LOWER.y} width={SLOT.width} height={LOWER.height} rx={4} className={cn(STOP_FILL[stop], 'stroke-cyan-950')} strokeWidth={1.5} />
                <text x={x + SLOT.width / 2} y={LOWER.y + LOWER.height / 2} dy="0.36em" textAnchor="middle" fontSize={26} className="fill-ink-strong font-display font-bold">
                  {stop}
                </text>
              </g>
            )
          })}
        </g>
        <line x1={door} x2={door} y1={BODY.top} y2={BODY.floor} className="stroke-cyan-300" strokeWidth={2.5} strokeDasharray="7 5" strokeLinecap="round" />
        <line x1={door} x2={door} y1={TICK.top} y2={TICK.bottom} className="stroke-cyan-300" strokeWidth={1.5} />
      </svg>
      <span
        data-door
        className="absolute -translate-x-1/2 text-body font-semibold whitespace-nowrap text-cyan-300 pointer-coarse:text-body-lg"
        style={{ left: percent(door, VIEW.width), bottom: percent(VIEW.height - TICK.top, VIEW.height) }}>
        {t('landing.features.zones.door')}
      </span>
    </div>
  )
}
