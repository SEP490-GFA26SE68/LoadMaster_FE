import { PLANK_WIDTH, QuadWriter, scale, type ContainerBox, type Face, type Rgb, type ShellGeometry } from './container-structure'
import type { VanShape } from './van-shape'

/**
 * Hình học thuần của thân van liền khối quanh lòng thùng (AGENTS mục 7), cùng hệ trục với `container-structure.ts`: x dọc từ vách trước
 * = 0 tới cửa sau = L, y cao từ sàn = 0, z ngang từ vách trái = 0. Không import three.
 *
 * - `vanShell`: sàn, vách trước, hai vách bên và trần trong **một** lưới màu theo đỉnh, mặt đơn pháp tuyến hướng vào trong (trần hướng
 *   xuống) — vách gần camera và trần nhìn từ trên tự biến mất, hàng luôn thấy. Tấm phẳng màu thân, không gân; `detail` thêm khe cửa lùa và
 *   rãnh ray cửa lùa (chỉ là màu trên chính mặt vách, không nhô vào lòng thùng).
 * - `vanExterior`: các khối **ngoài** lòng thùng (y ≥ H, z ≤ 0 hoặc z ≥ W, hoặc dưới sàn): mép nóc bo tròn hai bên, xà trên cửa sau,
 *   hai trụ D, ngưỡng cửa, gờ chân thân ngang sàn. Không vòm nóc vắt ngang lòng thùng: nhìn từ trên không gì che hàng.
 */

export type VanShellColors = { readonly floor: Rgb; readonly wall: Rgb; readonly seam: Rgb }
export type VanPiece =
  | { readonly kind: 'box'; readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] }
  /** Thanh tròn dọc x — mép nóc bo */
  | { readonly kind: 'rod'; readonly radius: number; readonly x: readonly [number, number]; readonly y: number; readonly z: number }

/** Rãnh ray cửa lùa chạy ngang ở chừng này chiều cao lòng thùng; cửa lùa dài chừng này phần lòng thùng tính từ vách trước. */
export const SLIDING_RAIL_RATIO = 0.58
export const SLIDING_DOOR_RATIO = 0.42
/** Bề rộng một khe (khe cửa, rãnh ray) vẽ bằng màu trên vách. */
export const SEAM = 0.014
/** Mép nóc bo tròn: bán kính nửa phần nhỏ hơn của bề dày vách / nóc — thanh tròn ở góc không lấn vào lòng thùng. */
const ROOF_ROUND_SHARE = 0.5
/** Trụ D và xà trên cửa sau: dày theo x, lấn vào trong đầu thùng chừng này (vẫn ngoài lòng thùng theo z hoặc y). */
const REAR_FRAME = [0.03, 0.02] as const
const BELT_Y = [-0.05, 0.03] as const

type Cell = { readonly from: number; readonly to: number }
const cells = (cuts: number[]): Cell[] => {
  const sorted = [...new Set(cuts)].sort((a, b) => a - b)
  return sorted.slice(1).map((to, i) => ({ from: sorted[i]!, to }))
}

/** Vách bên của van: tấm phẳng; `detail` cắt khe trước / sau cửa lùa và rãnh ray từ sau cửa lùa tới gần cửa sau. */
function writeSide(out: QuadWriter, face: Face, length: number, height: number, colors: VanShellColors, detail: boolean) {
  if (!detail) { out.quad(face, 0, length, 0, height, colors.wall); return }
  const doorFront = 0.05, doorBack = Math.max(doorFront + 0.4, length * SLIDING_DOOR_RATIO)
  const railY = height * SLIDING_RAIL_RATIO, railEnd = Math.max(doorBack + SEAM, length - 0.06)
  const top = height - 0.04, bottom = 0.03
  const seams: [Cell, Cell][] = [
    [{ from: doorFront, to: doorFront + SEAM }, { from: bottom, to: top }],
    [{ from: doorBack, to: doorBack + SEAM }, { from: bottom, to: top }],
    [{ from: doorBack + SEAM, to: railEnd }, { from: railY, to: railY + SEAM }],
  ]
  const inside = (value: number, cell: Cell) => value > cell.from && value < cell.to
  for (const column of cells([0, doorFront, doorFront + SEAM, doorBack, doorBack + SEAM, railEnd, length])) {
    for (const row of cells([0, bottom, railY, railY + SEAM, top, height])) {
      const u = (column.from + column.to) / 2, v = (row.from + row.to) / 2
      const seam = seams.some(([x, y]) => inside(u, x) && inside(v, y))
      out.quad(face, column.from, column.to, row.from, row.to, seam ? colors.seam : colors.wall)
    }
  }
}

export function vanShell({ length: L, width: W, height: H }: ContainerBox, colors: VanShellColors, detail: boolean): ShellGeometry {
  const out = new QuadWriter()
  const floor: Face = { origin: [0, 0, 0], u: [0, 0, 1], v: [1, 0, 0], normal: [0, 1, 0] }
  const front: Face = { origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], normal: [1, 0, 0] }
  const left: Face = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] }
  const right: Face = { origin: [0, 0, W], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, -1] }
  const ceiling: Face = { origin: [0, H, 0], u: [0, 0, 1], v: [1, 0, 0], normal: [0, -1, 0] }
  if (detail) {
    // Sàn ván phủ thảm: các dải dọc rất gần màu nhau
    for (let z = 0, i = 0; z < W - 1e-6; z += PLANK_WIDTH, i++) {
      out.quad(floor, z, Math.min(W, z + PLANK_WIDTH), 0, L, i % 2 ? scale(colors.floor, 0.96) : colors.floor)
    }
  } else out.quad(floor, 0, W, 0, L, colors.floor)
  out.quad(front, 0, W, 0, H, colors.wall)
  writeSide(out, left, L, H, colors, detail)
  writeSide(out, right, L, H, colors, detail)
  out.quad(ceiling, 0, W, 0, L, scale(colors.wall, 0.86))
  return { positions: new Float32Array(out.positions), normals: new Float32Array(out.normals), colors: new Float32Array(out.colors) }
}

const box = (min: [number, number, number], max: [number, number, number]): VanPiece => ({ kind: 'box', min, max })

export function vanExterior({ length: L, width: W, height: H }: ContainerBox, shape: Pick<VanShape, 'wall' | 'roofY'>): VanPiece[] {
  const w = shape.wall, roofY = shape.roofY
  const round = Math.min(w, roofY - H) * ROOF_ROUND_SHARE
  const [back, out] = REAR_FRAME
  const pieces: VanPiece[] = []
  for (const [inner, outer, sign] of [[0, -w, -1], [W, W + w, 1]] as const) {
    const lo = Math.min(inner, outer), hi = Math.max(inner, outer)
    // Mép nóc bo: phần đứng, phần nằm lùi vào trong một bán kính, thanh tròn ở góc ngoài
    pieces.push(box([0, H, lo], [L, roofY - round, hi]))
    pieces.push(sign < 0 ? box([0, roofY - round, outer + round], [L, roofY, inner]) : box([0, roofY - round, inner], [L, roofY, outer - round]))
    pieces.push({ kind: 'rod', radius: round, x: [0, L], y: roofY - round, z: outer - sign * round })
    // Gờ chân thân ngang sàn và trụ D ở mép cửa sau
    pieces.push(box([0, BELT_Y[0], lo], [L, BELT_Y[1], hi]))
    pieces.push(box([L - back, 0, lo], [L + out, H, hi]))
  }
  pieces.push(box([L - back, H, -w], [L + out, roofY, W + w]))
  pieces.push(box([L - back, -0.05, -w], [L + back, 0, W + w]))
  return pieces
}
