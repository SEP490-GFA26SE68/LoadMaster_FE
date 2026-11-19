import type { VehicleConfig } from '@/domain/models'
import { cn } from '@/lib/utils'
import type { AxleTry } from './try-axle'

/** Hình nhìn ngang, đơn vị cm: sàn thùng ở `FLOOR_Y`, thùng cao `BODY_H`, cabin trước vách trước, bánh dưới khung gầm. */
const BODY_H = 200
const FLOOR_Y = BODY_H + 24
const CHASSIS_H = 14
const WHEEL_R = 42
const WHEEL_Y = FLOOR_Y + CHASSIS_H + 26
const GROUND_Y = WHEEL_Y + WHEEL_R
const CAB_FRONT = -168
const CAB_BACK = -14
const CAB_H = 152
const VIEW_PAD = 16

/**
 * Khối hàng minh hoạ: tâm khối đứng đúng vị trí trọng tâm đang kéo; khối dài và cao hơn khi hàng nặng hơn, không bao giờ ra ngoài lòng
 * thùng. Chỉ là hình — kích thước khối không vào phép tính nào.
 */
function cargoBlock(lengthCm: number, massKg: number, payloadKg: number, centerXCm: number) {
  const share = payloadKg > 0 ? Math.min(1, massKg / payloadKg) : 0
  if (share <= 0) return null
  const room = 2 * Math.min(centerXCm, lengthCm - centerXCm)
  const length = Math.max(40, Math.min(room, lengthCm * (0.3 + 0.7 * share)))
  const height = Math.max(26, Math.min(BODY_H * 0.9, (share * lengthCm * BODY_H * 0.62) / length))
  return { x: centerXCm - length / 2, y: FLOOR_Y - height, length, height }
}

function Wheel({ x, over }: { x: number; over: boolean }) {
  return (
    <g>
      {over ? <circle cx={x} cy={WHEEL_Y} r={WHEEL_R + 9} className="fill-none stroke-red-500" strokeWidth={6} strokeDasharray="14 8" /> : null}
      <circle cx={x} cy={WHEEL_Y} r={WHEEL_R} className={over ? 'fill-red-700' : 'fill-n-800'} />
      <circle cx={x} cy={WHEEL_Y} r={WHEEL_R * 0.42} className="fill-n-200" />
    </g>
  )
}

/**
 * Xe mẫu nhìn ngang (SVG, `aria-hidden` — số và chữ nằm ở bảng bên dưới): cabin, thùng, hai nhóm trục đứng đúng `positionXCm` đã khai,
 * khối hàng và dấu trọng tâm chạy theo hai thanh kéo. Trục vượt giới hạn có bánh đỏ kèm vòng nét đứt — bảng số vẫn nói bằng chữ.
 */
export function TryAxleTruck({ vehicle, result, className }: { vehicle: VehicleConfig; result: AxleTry; className?: string }) {
  const length = vehicle.innerLengthCm
  const block = cargoBlock(length, result.massKg, vehicle.maxPayloadKg, result.centerXCm)
  const markY = block ? block.y + block.height / 2 : FLOOR_Y - 30
  const minX = CAB_FRONT - VIEW_PAD
  return (
    <svg aria-hidden viewBox={`${minX} 0 ${length + VIEW_PAD - minX} ${GROUND_Y + 10}`} className={cn('block h-auto w-full', className)} data-try-axle-truck="">
      <line x1={minX} x2={length + VIEW_PAD} y1={GROUND_Y} y2={GROUND_Y} className="stroke-n-300" strokeWidth={3} />
      {/* Khung gầm và cabin */}
      <rect x={CAB_FRONT} y={FLOOR_Y} width={length - CAB_FRONT} height={CHASSIS_H} rx={4} className="fill-n-600" />
      <path
        d={`M ${CAB_FRONT} ${FLOOR_Y} V ${FLOOR_Y - CAB_H * 0.5} L ${CAB_FRONT + 46} ${FLOOR_Y - CAB_H} H ${CAB_BACK} V ${FLOOR_Y} Z`}
        className="fill-n-100 stroke-n-500"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d={`M ${CAB_FRONT + 14} ${FLOOR_Y - CAB_H * 0.5} L ${CAB_FRONT + 52} ${FLOOR_Y - CAB_H + 14} H ${CAB_BACK - 44} V ${FLOOR_Y - CAB_H * 0.5} Z`}
        className="fill-cyan-100"
      />
      {/* Lòng thùng */}
      <rect x={0} y={FLOOR_Y - BODY_H} width={length} height={BODY_H} rx={4} className="fill-n-25 stroke-n-500" strokeWidth={4} />
      {block ? <rect x={block.x} y={block.y} width={block.length} height={block.height} rx={3} className="fill-cyan-200 stroke-cyan-600" strokeWidth={3} /> : null}
      {/* Trọng tâm hàng: đường dóng xuống sàn và dấu trọng tâm */}
      <line x1={result.centerXCm} x2={result.centerXCm} y1={markY} y2={GROUND_Y} className="stroke-n-800" strokeWidth={3} strokeDasharray="10 8" />
      <circle cx={result.centerXCm} cy={markY} r={17} className="fill-n-0 stroke-n-900" strokeWidth={4} />
      <path
        d={`M ${result.centerXCm} ${markY} V ${markY - 17} A 17 17 0 0 1 ${result.centerXCm + 17} ${markY} Z M ${result.centerXCm} ${markY} V ${markY + 17} A 17 17 0 0 1 ${result.centerXCm - 17} ${markY} Z`}
        className="fill-n-900"
      />
      <Wheel x={result.front.positionXCm} over={result.front.overKg > 0} />
      <Wheel x={result.rear.positionXCm} over={result.rear.overKg > 0} />
    </svg>
  )
}
