import type { CSSProperties } from 'react'
import './truck-motion.css'

/**
 * Xe tải nhìn ngang — dùng chung cho cảnh "Soạn, xếp, giao" của khung dính (nền sáng, đầu xe bên trái, cửa sau bên phải) và hình của dải
 * nguyên tắc xếp hàng (nền tối, đầu xe bên phải để xe chạy tới về bên phải). Chỉ vẽ cabin, khung gầm, bánh, ống xả, khói và mặt đường;
 * thùng và hàng do nơi gọi vẽ trong `body`. Tách từng phần để nơi gọi cho thân xe nhún, bánh quay, khói bay riêng (`truck-motion.css`).
 */

/** Hộp thùng xe (đơn vị SVG): mép trái, mép phải, nóc và sàn. Cửa sau ở phía đuôi xe — đối diện cabin. */
export type TruckBody = { left: number; right: number; top: number; floor: number }
/** Hướng đầu xe: `left` — cabin bên trái, cửa sau bên phải; `right` — ngược lại. */
export type TruckFacing = 'left' | 'right'

const TONES = {
  light: { cab: 'fill-n-700', glass: 'fill-cyan-100', rail: 'fill-n-700', wheel: 'fill-n-800', tyre: 'stroke-surface', hub: 'fill-n-300', ground: 'stroke-n-200', pipe: 'fill-n-600', smoke: 'fill-n-400' },
  dark: { cab: 'fill-border-dark', glass: 'fill-cyan-800', rail: 'fill-border-dark', wheel: 'fill-panel-dark', tyre: 'stroke-sky-text-3', hub: 'fill-sky-text-3', ground: 'stroke-border-dark', pipe: 'fill-sky-text-3', smoke: 'fill-n-200' },
} as const
export type TruckTone = keyof typeof TONES

const CAB_WIDTH = 64
const CAB_GAP = 6
const WHEEL_R = 14

/** Mặt đường của một thùng: đáy bánh. */
export function groundOf(body: TruckBody): number {
  return body.floor + 10 + WHEEL_R + 2
}

/** Soi một toạ độ x qua tâm thùng: hình của xe quay đầu sang phải. */
function mirrorX(body: TruckBody, x: number): number {
  return body.left + body.right - x
}

/** Tâm ba bánh: một bánh dưới cabin, hai bánh sau dưới thùng; `y` chung. */
export function wheelsOf(body: TruckBody, facing: TruckFacing = 'left'): { xs: number[]; y: number } {
  const cabLeft = body.left - CAB_GAP - CAB_WIDTH
  const xs = [cabLeft + 30, body.right - 92, body.right - 56]
  return { xs: facing === 'left' ? xs : xs.map((x) => mirrorX(body, x)), y: body.floor + 12 }
}

/** Miệng ống xả: dưới khung gầm, ở đuôi xe, hướng ra sau (`dir`: +1 sang phải, −1 sang trái) — khói bay ra từ đây. */
export function tailpipeOf(body: TruckBody, facing: TruckFacing = 'left'): { x: number; y: number; dir: 1 | -1 } {
  const y = body.floor + 13
  return facing === 'left' ? { x: body.right + 5, y, dir: 1 } : { x: body.left - 5, y, dir: -1 }
}

/** Mặt đường: một vạch ngang từ `from` tới `to`. */
export function TruckGround({ body, tone, from = 0, to }: { body: TruckBody; tone: TruckTone; from?: number; to: number }) {
  const ground = groundOf(body)
  return <line x1={from} x2={to} y1={ground} y2={ground} className={TONES[tone].ground} strokeWidth={1.5} strokeLinecap="round" />
}

/** Thanh khung gầm và cabin (kính chắn gió xiên về phía đầu xe). Không chữ nào bên trong nên soi gương được. */
export function TruckChassis({ body, tone, facing = 'left' }: { body: TruckBody; tone: TruckTone; facing?: TruckFacing }) {
  const colors = TONES[tone]
  const right = body.left - CAB_GAP
  const left = right - CAB_WIDTH
  const top = body.top + 16
  const cab = `M${left} ${body.floor} V${top + 34} Q${left} ${top + 24} ${left + 8} ${top + 20} L${left + 26} ${top + 2} Q${left + 28} ${top} ${left + 32} ${top} H${right} V${body.floor} Z`
  const glass = `M${left + 13} ${top + 30} L${left + 30} ${top + 9} H${right - 8} V${top + 30} Z`
  const mirror = facing === 'right' ? `matrix(-1 0 0 1 ${body.left + body.right} 0)` : undefined
  return (
    <g transform={mirror}>
      <rect x={left + 4} y={body.floor} width={body.right - left - 4} height={10} rx={2} className={colors.rail} />
      <path d={cab} className={colors.cab} />
      <path d={glass} className={colors.glass} />
    </g>
  )
}

/**
 * Ba bánh. `spinClassName`: lớp quay của từng bánh (quay quanh tâm của chính nó) — bánh có thêm ba chốt quanh moay-ơ để thấy được bánh
 * đang quay.
 */
export function TruckWheels({ body, tone, facing = 'left', spinClassName }: { body: TruckBody; tone: TruckTone; facing?: TruckFacing; spinClassName?: string }) {
  const colors = TONES[tone]
  const { xs, y } = wheelsOf(body, facing)
  return (
    <g>
      {xs.map((cx) => (
        <g key={cx} data-wheel="" className={spinClassName}>
          <circle cx={cx} cy={y} r={WHEEL_R} className={`${colors.wheel} ${colors.tyre}`} strokeWidth={2} />
          <circle cx={cx} cy={y} r={5} className={colors.hub} />
          {spinClassName
            ? [0, 120, 240].map((angle) => {
                const rad = (angle * Math.PI) / 180
                return <circle key={angle} cx={cx + Math.cos(rad) * 9} cy={y + Math.sin(rad) * 9} r={1.6} className={colors.hub} />
              })
            : null}
        </g>
      ))}
    </g>
  )
}

/** Ống xả ngắn dưới khung gầm ở đuôi xe, miệng ống tại `tailpipeOf`. */
export function TruckTailpipe({ body, tone, facing = 'left' }: { body: TruckBody; tone: TruckTone; facing?: TruckFacing }) {
  const { x, y, dir } = tailpipeOf(body, facing)
  const length = 16
  return <rect x={dir === 1 ? x - length : x} y={y - 2} width={length} height={4} rx={2} className={TONES[tone].pipe} />
}

/** Một cụm khói: vị trí tương đối với miệng ống xả (theo hướng ra sau), bán kính, lớp chuyển động và style (vd. mốc `--at`). */
export type SmokePuff = { dx: number; dy: number; r: number; className?: string; style?: CSSProperties }

/**
 * Ba múi phụ của một cụm khói quanh múi chính (vị trí và bán kính theo bán kính múi chính, `x` theo hướng ra sau của xe) — cùng hình với
 * khói của xe ở chân trang (`footer.css`) và khói 3D của phần mở đầu: một cụm không phải đĩa tròn đều.
 */
const SMOKE_LOBES: readonly { x: number; y: number; r: number }[] = [
  { x: -1.2, y: 0.2, r: 0.8 },
  { x: 1, y: 0.4, r: 0.6 },
  { x: -0.2, y: -0.8, r: 0.8 },
]

/**
 * Khói ống xả: vài cụm ở miệng ống, mỗi cụm một múi chính và ba múi phụ cùng màu (`--n-200` trên nền tối, như khói của chân trang và của
 * khung 3D). Đứng yên thì trong suốt (`lp-smoke`, `truck-motion.css`) — hình tĩnh không có khói; lớp chuyển động của từng cụm cho nó phồng
 * lên, bay ra sau rồi tan, một lần. `--puff-dir` là hướng ra sau của xe. Trang trí, nằm trong hình `aria-hidden`.
 */
export function TruckSmoke({ body, tone, facing = 'left', puffs }: { body: TruckBody; tone: TruckTone; facing?: TruckFacing; puffs: readonly SmokePuff[] }) {
  const { x, y, dir } = tailpipeOf(body, facing)
  return (
    <g style={{ '--puff-dir': dir } as CSSProperties}>
      {puffs.map((puff, index) => {
        const cx = x + dir * puff.dx
        const cy = y + puff.dy
        return (
          <g key={index} data-puff="" className={`lp-smoke ${TONES[tone].smoke} ${puff.className ?? ''}`} style={puff.style}>
            <circle cx={cx} cy={cy} r={puff.r} />
            {SMOKE_LOBES.map((lobe) => (
              <circle key={`${lobe.x}:${lobe.y}`} cx={cx - dir * lobe.x * puff.r} cy={cy + lobe.y * puff.r} r={lobe.r * puff.r} />
            ))}
          </g>
        )
      })}
    </g>
  )
}

/** Cabin, khung gầm, ba bánh và mặt đường của xe đầu bên trái (cảnh "Soạn, xếp, giao"). */
export function TruckFrame({ body, tone, groundFrom = 0, groundTo }: { body: TruckBody; tone: TruckTone; groundFrom?: number; groundTo: number }) {
  return (
    <g>
      <TruckGround body={body} tone={tone} from={groundFrom} to={groundTo} />
      <TruckChassis body={body} tone={tone} />
      <TruckWheels body={body} tone={tone} />
    </g>
  )
}
