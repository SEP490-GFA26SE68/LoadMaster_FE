/**
 * Xe tải nhìn ngang, đầu xe bên trái, cửa sau bên phải — dùng chung cho cảnh "Soạn, xếp, giao" của khung dính (nền sáng) và hình của dải
 * nguyên tắc xếp hàng (nền tối). Chỉ vẽ cabin, khung gầm, bánh và mặt đường; thùng và hàng do nơi gọi vẽ trong `body`.
 */

/** Hộp thùng xe (đơn vị SVG): mép trái, mép phải (cửa sau), nóc và sàn. */
export type TruckBody = { left: number; right: number; top: number; floor: number }

const TONES = {
  light: { cab: 'fill-n-700', glass: 'fill-cyan-100', rail: 'fill-n-700', wheel: 'fill-n-800', tyre: 'stroke-surface', hub: 'fill-n-300', ground: 'stroke-n-200' },
  dark: { cab: 'fill-border-dark', glass: 'fill-cyan-800', rail: 'fill-border-dark', wheel: 'fill-panel-dark', tyre: 'stroke-sky-text-3', hub: 'fill-sky-text-3', ground: 'stroke-border-dark' },
} as const
export type TruckTone = keyof typeof TONES

const CAB_WIDTH = 64
const CAB_GAP = 6
const WHEEL_R = 14

/** Mặt đường của một thùng: đáy bánh. */
export function groundOf(body: TruckBody): number {
  return body.floor + 10 + WHEEL_R + 2
}

/** Cabin (kính chắn gió xiên), thanh khung gầm, ba bánh (một trước, hai sau) và mặt đường. */
export function TruckFrame({ body, tone, groundFrom = 0, groundTo }: { body: TruckBody; tone: TruckTone; groundFrom?: number; groundTo: number }) {
  const colors = TONES[tone]
  const right = body.left - CAB_GAP
  const left = right - CAB_WIDTH
  const top = body.top + 16
  const wheelY = body.floor + 12
  const ground = groundOf(body)
  const cab = `M${left} ${body.floor} V${top + 34} Q${left} ${top + 24} ${left + 8} ${top + 20} L${left + 26} ${top + 2} Q${left + 28} ${top} ${left + 32} ${top} H${right} V${body.floor} Z`
  const glass = `M${left + 13} ${top + 30} L${left + 30} ${top + 9} H${right - 8} V${top + 30} Z`
  return (
    <g>
      <line x1={groundFrom} x2={groundTo} y1={ground} y2={ground} className={colors.ground} strokeWidth={1.5} strokeLinecap="round" />
      <rect x={left + 4} y={body.floor} width={body.right - left - 4} height={10} rx={2} className={colors.rail} />
      <path d={cab} className={colors.cab} />
      <path d={glass} className={colors.glass} />
      {[left + 30, body.right - 92, body.right - 56].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={wheelY} r={WHEEL_R} className={`${colors.wheel} ${colors.tyre}`} strokeWidth={2} />
          <circle cx={cx} cy={wheelY} r={5} className={colors.hub} />
        </g>
      ))}
    </g>
  )
}
