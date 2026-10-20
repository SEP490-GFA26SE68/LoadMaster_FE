import type { PlanObjective } from '@/domain/models'
import { stopColor } from '@/lib/stops'
import { cn } from '@/lib/utils'
import { useRevealMotion } from '../reveal'
import { svgPiece } from './svg-piece'

/**
 * Hình thu nhỏ của ba phương án trong ô "Ba phương án" (trang trí, `aria-hidden`): cùng một thùng nhìn từ trên — vách trước bên trái, cửa
 * sau bên phải (vạch cyan), hai cụm bánh dưới thùng — xếp theo ba mục tiêu. A: kín thùng. B: khối hàng dồn vào giữa hai cụm trục, có dấu
 * trọng tâm. C: bốn vùng theo màu điểm giao, điểm cuối sát vách trước. Không số liệu nào: đây là hình nói ý của mục tiêu, không phải kết
 * quả của lần chạy nào. Toạ độ trong khung 96 × 30.
 */
const VIEW = { width: 96, height: 30 }
const BODY = { x: 1, y: 1, width: 86, height: 22 }
const INNER = { x: 3, y: 3, width: 82, height: 18 }
const GAP = 1
const ROW_HEIGHT = (INNER.height - GAP) / 2
/** Hai cụm bánh: trục trước gần vách trước, cụm trục sau gần cửa — như khung gầm của Planner nhìn từ trên. */
const AXLES = [
  { x: 10, width: 10 },
  { x: 58, width: 18 },
] as const
/** Mốc (ms sau lúc dòng hiện ra): từng ô hàng bật ra từ vách trước ra cửa, cách nhau 28 ms. */
const CELL_AT = 260
const CELL_STEP = 28

type Cell = { x: number; y: number; width: number; height: number; fill?: string }

/** Lưới `columns` cột × hai hàng trải từ `from` tới `to` theo chiều dài thùng; `fill` theo cột (vắng là màu cyan của lớp). */
function grid(from: number, to: number, columns: number, fill?: (column: number) => string | undefined): Cell[] {
  const width = (to - from - (columns - 1) * GAP) / columns
  return Array.from({ length: columns * 2 }, (_, index) => {
    const column = Math.floor(index / 2)
    const row = index % 2
    return { x: from + column * (width + GAP), y: INNER.y + row * (ROW_HEIGHT + GAP), width, height: ROW_HEIGHT, fill: fill?.(column) }
  })
}

/** Điểm giao của cột thứ `column` trong tám cột của C: hai cột một vùng, điểm 4 sát vách trước. */
const ZONE_STOP = (column: number) => 4 - Math.floor(column / 2)

const CELLS: Record<PlanObjective, Cell[]> = {
  MAX_VOLUME: grid(INNER.x, INNER.x + INNER.width, 7),
  AXLE_BALANCE: grid(19, 69, 4),
  MIN_REHANDLING: grid(INNER.x, INNER.x + INNER.width, 8, (column) => stopColor(ZONE_STOP(column))),
}

/** Tâm của khối hàng B (giữa bốn cột, giữa hai hàng): dấu trọng tâm. */
const COG = { x: 44, y: INNER.y + INNER.height / 2 }

/** Một hình thu nhỏ; `className` cho cỡ hiển thị (khung giữ tỉ lệ 96 : 30). */
export function PlanStrip({ objective, className }: { objective: PlanObjective; className?: string }) {
  const motion = useRevealMotion()
  const cells = CELLS[objective]
  return (
    <svg aria-hidden viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} className={cn('block h-auto flex-none', className)}>
      {AXLES.map((axle) => (
        <rect key={axle.x} x={axle.x} y={BODY.y + BODY.height + 1} width={axle.width} height={4} rx={1.5} className="fill-ink-3" />
      ))}
      <rect x={BODY.x} y={BODY.y} width={BODY.width} height={BODY.height} rx={3} className="fill-bg stroke-line-strong" strokeWidth={1} />
      {cells.map((cell, index) => (
        <rect key={index} x={cell.x} y={cell.y} width={cell.width} height={cell.height} rx={1.2} fill={cell.fill}
          {...svgPiece(motion, 'lp-pop', CELL_AT + index * CELL_STEP, cell.fill ? undefined : 'fill-cyan-300')} />
      ))}
      {objective === 'AXLE_BALANCE' ? (
        <g {...svgPiece(motion, 'lp-pop', CELL_AT + cells.length * CELL_STEP + 80)}>
          <circle cx={COG.x} cy={COG.y} r={3.6} className="fill-bg stroke-ink-strong" strokeWidth={1.2} />
          <path d={`M${COG.x - 3.6} ${COG.y} h7.2 M${COG.x} ${COG.y - 3.6} v7.2`} className="stroke-ink-strong" strokeWidth={1} />
        </g>
      ) : null}
      <path d={`M${BODY.x + BODY.width + 3} ${BODY.y + 2} v${BODY.height - 4}`} className="stroke-cyan-500" strokeWidth={2} strokeDasharray="3 2" strokeLinecap="round" />
    </svg>
  )
}
