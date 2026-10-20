import type { CSSProperties } from 'react'
import type { Projector } from '@/lib/isometric'
import { cn } from '@/lib/utils'

/**
 * Bộ vẽ chung của các cảnh trong khung dính Cách hoạt động (`StepScenes`): khung SVG, màu điểm giao, khối hộp đẳng cự, mốc điểm giao có
 * số, dấu kiểm và nhãn QR thu nhỏ. Màu chỉ lấy từ token: bốn màu điểm giao qua lớp `fill-stop-n`, mặt khuất và mặt đỉnh của khối pha bằng
 * `color-mix` từ token — không mã màu nào trong component.
 */

/** Khung chung của mọi cảnh (đơn vị SVG); cảnh co giãn giữ tỉ lệ trong vùng giữa của khung dính. */
export const SCENE_WIDTH = 400
export const SCENE_HEIGHT = 220

/** Lớp tô của bốn màu điểm giao — viết đủ tên để Tailwind quét thấy. */
export const STOP_FILL = { 1: 'fill-stop-1', 2: 'fill-stop-2', 3: 'fill-stop-3', 4: 'fill-stop-4' } as const
export type SceneStop = keyof typeof STOP_FILL
/** Thứ tự xếp lên xe, từ vách trước (sâu nhất) ra cửa sau: điểm giao cuối lên trước. */
export const LOAD_ORDER = [4, 3, 2, 1] as const satisfies readonly SceneStop[]

/** Màu gốc của một khối: màu điểm giao, hay xám ánh cyan cho kiện chưa gắn điểm nào. */
export const stopTone = (stop: SceneStop) => `var(--stop-${stop})`
export const NEUTRAL_TONE = 'var(--n-200)'

/** Lớp và mốc của một mảnh chuyển động (`svgPiece`): nối vào phần tử SVG. */
export type Piece = { className?: string; style?: CSSProperties }

/** Pha màu bằng token: `amount` % màu gốc, phần còn lại là mực tối (mặt khuất) hay nền trắng (mặt đỉnh). */
function mix(base: string, amount: number, other: string): string {
  return `color-mix(in srgb, ${base} ${amount}%, ${other})`
}

/** Khối hộp trong hệ của phép chiếu: x dọc (ra phía phải dưới), y ngang (ra phía trái dưới), z cao. */
export type SceneBox = { x: number; y: number; z: number; l: number; w: number; h: number; tone: string }

type Polygon = { points: string; fill: string }

/** Ba mặt thấy được: mặt y + w (trái, tối nhất), mặt x + l (phải), mặt đỉnh (sáng). */
export function boxPolygons(box: SceneBox, project: Projector): Polygon[] {
  const { x, y, z, l, w, h, tone } = box
  const ink = 'var(--ink-strong)'
  return [
    { points: [project(x, y + w, z), project(x + l, y + w, z), project(x + l, y + w, z + h), project(x, y + w, z + h)].join(' '), fill: mix(tone, 68, ink) },
    { points: [project(x + l, y, z), project(x + l, y + w, z), project(x + l, y + w, z + h), project(x + l, y, z + h)].join(' '), fill: mix(tone, 84, ink) },
    { points: [project(x, y, z + h), project(x + l, y, z + h), project(x + l, y + w, z + h), project(x, y + w, z + h)].join(' '), fill: mix(tone, 82, 'var(--bg)') },
  ]
}

/** Thứ tự vẽ xa trước gần sau cho các khối không chồng nhau trên lưới (cùng khoá như `sortByDepth` của `lib/isometric`). */
export function byDepth<T extends SceneBox>(boxes: readonly T[]): T[] {
  return [...boxes].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z))
}

/** Một khối hộp: ba mặt, đường nối sáng để các khối liền nhau vẫn tách bạch. */
export function IsoBlock({ box, project, piece }: { box: SceneBox; project: Projector; piece?: Piece }) {
  return (
    <g className={piece?.className} style={piece?.style}>
      {boxPolygons(box, project).map((face, index) => (
        <polygon key={index} points={face.points} style={{ fill: face.fill }} className="stroke-surface" strokeWidth={1} strokeLinejoin="round" />
      ))}
    </g>
  )
}

/** Mốc điểm giao như `StopDot`: tròn màu điểm giao, số tối ở giữa (chữ tối trên bốn màu đầu — `stopForeground`), viền nền thẻ. */
export function StopMark({ stop, x, y, r = 16, piece }: { stop: SceneStop; x: number; y: number; r?: number; piece?: Piece }) {
  return (
    <g className={piece?.className} style={piece?.style}>
      <circle cx={x} cy={y} r={r} className={cn(STOP_FILL[stop], 'stroke-surface')} strokeWidth={3} />
      <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={Math.round(r * 1.1)} className="fill-ink-strong font-display font-bold">
        {stop}
      </text>
    </g>
  )
}

/** Dấu kiểm tròn: nền `--primary`, nét trắng 1,5 theo cỡ của dấu. */
export function CheckBadge({ x, y, r = 10, piece }: { x: number; y: number; r?: number; piece?: Piece }) {
  const tick = `M${x - r * 0.42} ${y + r * 0.02} l${r * 0.3} ${r * 0.32} l${r * 0.56} ${-r * 0.6}`
  return (
    <g className={piece?.className} style={piece?.style}>
      <circle cx={x} cy={y} r={r} className="fill-primary stroke-surface" strokeWidth={2} />
      <path d={tick} fill="none" className="stroke-bg" strokeWidth={Math.max(1.5, r * 0.2)} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

/** Ô của nhãn QR thu nhỏ (3 × 3), mẫu cố định chỉ để vẽ — không mã hoá gì. */
export const QR_CELLS = [
  [0, 0], [2, 0], [1, 1], [0, 2], [2, 1], [1, 2],
] as const

/** Nhãn QR phẳng: ô trắng viền mực, chín ô chấm mực (`QR_CELLS`). */
export function FlatQr({ x, y, size, piece }: { x: number; y: number; size: number; piece?: Piece }) {
  const pad = size * 0.16
  const cell = (size - pad * 2) / 3
  return (
    <g className={piece?.className} style={piece?.style}>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.14} className="fill-bg stroke-ink-2" strokeWidth={1} />
      {QR_CELLS.map(([column, row]) => (
        <rect key={`${column}-${row}`} x={x + pad + column * cell} y={y + pad + row * cell} width={cell} height={cell} className="fill-ink-strong" />
      ))}
    </g>
  )
}

/**
 * Nhãn QR dán trên một mặt đứng của khối đẳng cự. `face` là mặt chứa nhãn: `x` (mặt x = `at`, nhãn trải theo y) hay `y` (mặt y = `at`,
 * nhãn trải theo x); `from`/`to` là hai góc của nhãn trên mặt đó, (trải, cao).
 */
export function IsoQr({ project, face, at, from, to, piece }: {
  project: Projector
  face: 'x' | 'y'
  at: number
  from: readonly [number, number]
  to: readonly [number, number]
  piece?: Piece
}) {
  const point = (u: number, v: number) => (face === 'x' ? project(at, u, v) : project(u, at, v))
  const quad = (u0: number, v0: number, u1: number, v1: number) => [point(u0, v1), point(u1, v1), point(u1, v0), point(u0, v0)].join(' ')
  const [u0, v0] = from
  const [u1, v1] = to
  const pad = (u1 - u0) * 0.16
  const cellU = (u1 - u0 - pad * 2) / 3
  const cellV = (v1 - v0 - pad * 2) / 3
  return (
    <g className={piece?.className} style={piece?.style}>
      <polygon points={quad(u0, v0, u1, v1)} className="fill-bg stroke-ink-2" strokeWidth={0.75} strokeLinejoin="round" />
      {QR_CELLS.map(([column, row]) => {
        const cu = u0 + pad + column * cellU
        const cv = v1 - pad - (row + 1) * cellV
        return <polygon key={`${column}-${row}`} points={quad(cu, cv, cu + cellU, cv + cellV)} className="fill-ink-strong" />
      })}
    </g>
  )
}
