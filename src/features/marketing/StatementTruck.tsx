import { useId, type CSSProperties } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useRevealRef } from './reveal'
import { LOAD_ORDER, STOP_FILL } from './steps/scene-kit'
import { groundOf, TruckChassis, TruckGround, TruckSmoke, TruckTailpipe, TruckWheels, type SmokePuff, type TruckBody } from './steps/truck-side'

/** Xe nhìn ngang trong khung 460 × 210, đầu xe bên phải (xe chạy tới về bên phải), cửa sau bên trái. */
const VIEW = { width: 460, height: 210 }
const BODY: TruckBody = { left: 56, right: 364, top: 50, floor: 162 }
const FACING = 'right'
/** Ô hàng của bốn điểm giao, từ cửa sau vào tới vách trước: điểm 1 sát cửa, điểm 4 sâu nhất; mỗi ô hai kiện chồng nhau. */
const SLOT = { first: BODY.left + 8, width: 66, step: 75 }
const UPPER = { y: 58, height: 46 }
const LOWER = { y: 108, height: 50 }
/** Vạch chỉ cửa trên nóc thùng; nhãn "Cửa sau" đứng ngay trên vạch. */
const TICK = { top: BODY.top - 14, bottom: BODY.top - 4 }
/** Cửa cuốn ở mép đuôi thùng: đóng lại sau khi khối cuối vào chỗ. */
const DOOR = { x: BODY.left - 3, width: 7 }
/** Đường kéo dài sang phải ra ngoài khung hình (dải cắt ngang): xe chạy ra khỏi mép dải trên chính con đường này. Vạch kẻ đường cách 34. */
const ROAD = { to: VIEW.width + 420, dashY: groundOf(BODY) + 9, dash: 16, period: 34 }
const DASHES = Array.from({ length: Math.ceil(ROAD.to / ROAD.period) }, (_, index) => `M${index * ROAD.period} ${ROAD.dashY} h${ROAD.dash}`).join(' ')
/**
 * Khói: hai cụm lúc nổ máy (xe còn đứng), bốn cụm lúc xe lăn bánh; `--k` là thứ tự trong nhóm. Vẽ ở lớp mặt đường, không theo lớp xe: khói
 * ở lại chỗ ống xả vừa nhả ra rồi tan trong khi xe chạy đi.
 */
const PUFFS: readonly SmokePuff[] = [
  ...[0, 1].map((k) => ({ dx: 2 + k * 3, dy: -2 - k * 2, r: 5 + k, className: 'lp-puff', style: { '--k': k } as CSSProperties })),
  ...[0, 1, 2, 3].map((k) => ({ dx: 3, dy: -1 - (k % 2) * 3, r: 6 + (k % 2), className: 'lp-trail', style: { '--k': k } as CSSProperties })),
]

/** Vị trí trong khung hình theo phần trăm, để đặt chữ HTML đúng chỗ dù hình co giãn. */
function percent(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(3)}%`
}

/** Mép trái của ô chứa hàng điểm `stop` (điểm 1 sát cửa sau). */
function slotX(stop: number): number {
  return SLOT.first + (stop - 1) * SLOT.step
}

/**
 * Hình của dải nguyên tắc xếp hàng (trang trí, `aria-hidden` — câu của dải là chữ thay thế): xe tải nhìn ngang, đầu xe bên phải, cửa sau
 * bên trái; hàng của bốn điểm giao nằm 1 · 2 · 3 · 4 từ cửa sau vào tới cabin — hàng giao trước sát cửa, hàng giao sau nằm sâu. Hình tĩnh
 * (giảm chuyển động, chuyển động tắt): xe đủ bốn khối, cửa đã đóng, đứng yên, không khói.
 *
 * Chuyển động bật (`steps/truck-motion.css`): khối vào qua cửa sau theo thứ tự xếp — điểm 4 trước, điểm 1 sau cùng —, cửa cuốn đóng, máy nổ (khói),
 * rồi xe lăn bánh: thân xe nhún nhẹ, bánh quay, vạch kẻ đường trôi, khói ở lại sau ống xả, và xe chạy ra khỏi mép phải của dải. Trình duyệt có
 * view timeline: cả chuỗi gắn với vị trí cuộn của hình (`--truck`), cuộn ngược thì xe lùi về. Không có: chuỗi chạy theo thời gian một lần
 * (dưới năm giây) khi hình lộ ra (cổng `useRevealRef`). Hai lớp: mặt đường và khói đứng yên, xe và nhãn cửa cùng một lớp chạy đi — chỉ transform và
 * opacity, không đổi bố cục. Nhãn cửa là chữ HTML trên hình: 14 px, 16 px trên máy cảm ứng, dù hình co theo bề rộng.
 */
export function StatementTruck({ motion, className }: { motion: boolean; className?: string }) {
  const t = useT()
  const gateRef = useRevealRef<HTMLDivElement>()
  const ids = useId().replace(/[^\w-]/g, '')
  const cargoClip = `lp-statement-cargo-${ids}`
  const roadClip = `lp-statement-road-${ids}`
  const door = BODY.left
  const viewBox = `0 0 ${VIEW.width} ${VIEW.height}`
  return (
    <div ref={gateRef} aria-hidden className={cn('lp-truck relative', className)}>
      <svg viewBox={viewBox} overflow="visible" className="block h-auto w-full">
        <defs>
          <clipPath id={roadClip}>
            <rect x={0} y={0} width={ROAD.to} height={VIEW.height} />
          </clipPath>
        </defs>
        <TruckGround body={BODY} tone="dark" to={ROAD.to} />
        <g clipPath={`url(#${roadClip})`}>
          <path d={DASHES} data-road="" className={cn('stroke-border-dark', motion && 'lp-dash')} strokeWidth={2} strokeLinecap="round" />
        </g>
        {motion ? <TruckSmoke body={BODY} tone="dark" facing={FACING} puffs={PUFFS} /> : null}
      </svg>
      <div data-vehicle="" className={cn('absolute inset-0', motion && 'lp-drive')}>
        <svg viewBox={viewBox} overflow="visible" className="block size-full">
          <defs>
            <clipPath id={cargoClip}>
              <rect x={BODY.left} y={BODY.top} width={BODY.right - BODY.left} height={BODY.floor - BODY.top} />
            </clipPath>
          </defs>
          <g className={motion ? 'lp-bob' : undefined}>
            <TruckChassis body={BODY} tone="dark" facing={FACING} />
            <TruckTailpipe body={BODY} tone="dark" facing={FACING} />
            <path d={`M${door} ${BODY.top} H${BODY.right - 5} Q${BODY.right} ${BODY.top} ${BODY.right} ${BODY.top + 5} V${BODY.floor} H${door}`} className="fill-cyan-900 stroke-sky-text-3" strokeWidth={1.5} />
            {LOAD_ORDER.map((stop) => (
              <rect key={stop} x={slotX(stop)} y={UPPER.y} width={SLOT.width} height={LOWER.y + LOWER.height - UPPER.y} rx={4} fill="none" className="stroke-border-dark" strokeWidth={1.5} strokeDasharray="5 4" />
            ))}
            <g clipPath={`url(#${cargoClip})`}>
              {LOAD_ORDER.map((stop, order) => {
                const x = slotX(stop)
                const style = { '--q': (order / (LOAD_ORDER.length - 1)).toFixed(3), '--load-x': `${door - (x + SLOT.width)}px` } as CSSProperties
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
            {motion ? (
              <line x1={door} x2={door} y1={BODY.top} y2={BODY.floor} className="lp-doorway stroke-cyan-300" strokeWidth={2.5} strokeDasharray="7 5" strokeLinecap="round" />
            ) : null}
            <g data-door-panel="" className={motion ? 'lp-door' : undefined}>
              <rect x={DOOR.x} y={BODY.top} width={DOOR.width} height={BODY.floor - BODY.top} rx={2} className="fill-cyan-300" />
              <circle cx={DOOR.x + DOOR.width / 2} cy={(BODY.top + BODY.floor) / 2} r={1.8} className="fill-cyan-950" />
            </g>
            <line x1={door} x2={door} y1={TICK.top} y2={TICK.bottom} className="stroke-cyan-300" strokeWidth={1.5} />
          </g>
          <TruckWheels body={BODY} tone="dark" facing={FACING} spinClassName={motion ? 'lp-spin' : undefined} />
        </svg>
        <span
          data-door
          className="absolute -translate-x-1/2 text-body font-semibold whitespace-nowrap text-cyan-300 pointer-coarse:text-body-lg"
          style={{ left: percent(door, VIEW.width), bottom: percent(VIEW.height - TICK.top, VIEW.height) }}>
          {t('landing.features.zones.door')}
        </span>
      </div>
    </div>
  )
}
