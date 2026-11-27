/**
 * Hình học thuần của thùng xe (đơn vị scene, hệ góc thùng: x dọc từ vách trước = 0 tới cửa sau = L, y cao từ sàn = 0, z ngang từ
 * vách trái = 0). Không import three: component dựng BufferGeometry từ các mảng này.
 *
 * - `containerShell`: sàn + ba vách trong **một** lưới màu theo đỉnh. Mọi mặt đơn, pháp tuyến hướng vào trong (sàn hướng lên), nên
 *   vách gần camera tự biến mất cùng mọi chi tiết vẽ trên nó. Gân sóng tôn, trụ góc, đà nóc của vách và ray chằng hàng chỉ là màu
 *   đỉnh và pháp tuyến nghiêng trên chính mặt vách — **không nhô** vào lòng thùng, kiện xếp sát vách không xuyên gì.
 * - `containerFrame`: các hộp đặc nằm **ngoài** lòng thùng (gờ hai bên, ngưỡng cửa, trụ góc trước, đà nóc ngang, xà dọc nóc) — một
 *   lưới, nhìn thấy từ mọi phía.
 * - `containerEdges`: 12 cạnh của lòng thùng cho một `LineSegments` — cue định hướng ở mọi tier.
 */

export type Rgb = readonly [number, number, number]
export type ContainerBox = { readonly length: number; readonly width: number; readonly height: number }
export type ShellColors = { readonly floor: Rgb; readonly wall: Rgb; readonly trim: Rgb }
export type ShellGeometry = { readonly positions: Float32Array; readonly normals: Float32Array; readonly colors: Float32Array }
export type FrameTone = 'skirt' | 'beam'
export type FramePiece = { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number]; readonly tone: FrameTone }

/** Bước gân sóng tôn và bề rộng một gân (hai nửa nghiêng ngược nhau). */
export const RIB_PITCH = 0.3
export const RIB_WIDTH = 0.06
/** Nghiêng pháp tuyến của nửa gân (rad) — đủ cho một vệt sáng / tối nhẹ, không thành sọc gắt. */
const RIB_TILT = 0.22
/** Trụ góc vẽ trên vách, đà nóc vẽ ở mép trên vách, ray chằng hàng. */
export const POST_WIDTH = 0.06
export const TOP_BAND = 0.07
export const RAIL_HEIGHT = 0.05
/** Ván sàn chạy dọc thùng. */
export const PLANK_WIDTH = 0.16
/** Gờ thấp hai bên và ngưỡng cửa (như bản trước). */
const SKIRT_HEIGHT = 0.28
const SKIRT_THICKNESS = 0.03
/** Khung ngoài: tiết diện trụ góc / xà dọc nóc, đà nóc ngang và khoảng cách giữa hai đà. */
const FRAME_MEMBER = 0.045
const ROOF_BEAM_WIDTH = 0.032
const ROOF_BEAM_DEPTH = 0.03
export const ROOF_BEAM_PITCH = 1.4

/** Độ cao tâm các ray chằng hàng trên hai vách bên: thùng từ 1,6 m có hai tầng, thấp hơn một tầng. */
export function railHeights(height: number): number[] {
  return height >= 1.6 ? [height * 0.38, height * 0.72] : [height * 0.55]
}

type Band = { readonly from: number; readonly to: number; readonly kind: 'panel' | 'post' | 'ribA' | 'ribB' }

/** Chia một vách theo chiều ngang: trụ góc hai đầu, giữa là các bước gân (tấm phẳng + hai nửa gân). */
export function wallColumns(span: number): Band[] {
  const bands: Band[] = [{ from: 0, to: POST_WIDTH, kind: 'post' }]
  const inner = span - POST_WIDTH * 2
  const pitches = Math.max(1, Math.round(inner / RIB_PITCH))
  const pitch = inner / pitches
  for (let i = 0; i < pitches; i++) {
    const start = POST_WIDTH + i * pitch
    const ribStart = start + (pitch - RIB_WIDTH) / 2
    bands.push({ from: start, to: ribStart, kind: 'panel' })
    bands.push({ from: ribStart, to: ribStart + RIB_WIDTH / 2, kind: 'ribA' })
    bands.push({ from: ribStart + RIB_WIDTH / 2, to: ribStart + RIB_WIDTH, kind: 'ribB' })
    bands.push({ from: ribStart + RIB_WIDTH, to: start + pitch, kind: 'panel' })
  }
  bands.push({ from: span - POST_WIDTH, to: span, kind: 'post' })
  return bands
}

type Row = { readonly from: number; readonly to: number; readonly kind: 'panel' | 'rail' | 'top' }

/** Chia một vách theo chiều cao: tấm, ray chằng hàng (chỉ vách bên), đà nóc ở mép trên. */
export function wallRows(height: number, rails: boolean): Row[] {
  const rows: Row[] = []
  let y = 0
  for (const center of rails ? railHeights(height) : []) {
    const from = center - RAIL_HEIGHT / 2
    rows.push({ from: y, to: from, kind: 'panel' }, { from, to: from + RAIL_HEIGHT, kind: 'rail' })
    y = from + RAIL_HEIGHT
  }
  rows.push({ from: y, to: height - TOP_BAND, kind: 'panel' }, { from: height - TOP_BAND, to: height, kind: 'top' })
  return rows
}

export const scale = ([r, g, b]: Rgb, k: number): Rgb => [r * k, g * k, b * k]

/** Mặt phẳng của một vách: điểm gốc, trục ngang (u), trục cao (v), pháp tuyến vào trong. */
export type Face = { origin: Rgb; u: Rgb; v: Rgb; normal: Rgb }

export class QuadWriter {
  readonly positions: number[] = []
  readonly normals: number[] = []
  readonly colors: number[] = []
  /** Một ô chữ nhật [u0,u1]×[v0,v1] trên mặt `face`, hai tam giác quay mặt theo `normal` của mặt (pháp tuyến đỉnh có thể nghiêng). */
  quad(face: Face, u0: number, u1: number, v0: number, v1: number, color: Rgb, normal: Rgb = face.normal) {
    if (u1 - u0 <= 1e-6 || v1 - v0 <= 1e-6) return
    const at = (u: number, v: number) => [0, 1, 2].map((i) => face.origin[i]! + face.u[i]! * u + face.v[i]! * v)
    const a = at(u0, v0), b = at(u1, v0), c = at(u1, v1), d = at(u0, v1)
    // Thứ tự đỉnh ngược chiều kim đồng hồ nhìn từ phía pháp tuyến: (u × v) cùng chiều normal thì a-b-c, không thì đảo
    const cross = [face.u[1]! * face.v[2]! - face.u[2]! * face.v[1]!, face.u[2]! * face.v[0]! - face.u[0]! * face.v[2]!, face.u[0]! * face.v[1]! - face.u[1]! * face.v[0]!]
    const front = cross[0]! * face.normal[0] + cross[1]! * face.normal[1] + cross[2]! * face.normal[2] > 0
    const order = front ? [a, b, c, a, c, d] : [a, c, b, a, d, c]
    for (const p of order) { this.positions.push(...p); this.normals.push(...normal); this.colors.push(...color) }
  }
}

function tilted(face: Face, sign: 1 | -1): Rgb {
  const c = Math.cos(RIB_TILT), s = Math.sin(RIB_TILT) * sign
  const n = (i: number) => face.normal[i]! * c + face.u[i]! * s
  return [n(0), n(1), n(2)]
}

function writeWall(out: QuadWriter, face: Face, span: number, height: number, colors: ShellColors, rails: boolean) {
  const rows = wallRows(height, rails)
  for (const column of wallColumns(span)) {
    for (const row of rows) {
      const trim = column.kind === 'post' || row.kind !== 'panel'
      const rib = column.kind === 'ribA' || column.kind === 'ribB'
      const color = trim ? (row.kind === 'rail' ? colors.trim : scale(colors.trim, 0.9)) : rib ? scale(colors.wall, 1.07) : colors.wall
      const normal = rib && !trim ? tilted(face, column.kind === 'ribA' ? -1 : 1) : face.normal
      out.quad(face, column.from, column.to, row.from, row.to, color, normal)
    }
  }
}

/**
 * Sàn + vách trước + hai vách bên. `detail` tắt (tier low): mỗi mặt một ô một màu như bản cũ — vẫn một draw call.
 */
export function containerShell({ length: L, width: W, height: H }: ContainerBox, colors: ShellColors, detail: boolean): ShellGeometry {
  const out = new QuadWriter()
  const floor: Face = { origin: [0, 0, 0], u: [0, 0, 1], v: [1, 0, 0], normal: [0, 1, 0] }
  const front: Face = { origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], normal: [1, 0, 0] }
  const left: Face = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] }
  const right: Face = { origin: [0, 0, W], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, -1] }
  if (!detail) {
    out.quad(floor, 0, W, 0, L, colors.floor)
    out.quad(front, 0, W, 0, H, colors.wall)
    out.quad(left, 0, L, 0, H, colors.wall)
    out.quad(right, 0, L, 0, H, colors.wall)
  } else {
    // Ván sàn dọc thùng, xen hai sắc rất gần nhau; ván cuối hẹp hơn để vừa đúng bề rộng
    for (let z = 0, i = 0; z < W - 1e-6; z += PLANK_WIDTH, i++) {
      out.quad(floor, z, Math.min(W, z + PLANK_WIDTH), 0, L, i % 2 ? scale(colors.floor, 0.95) : colors.floor)
    }
    writeWall(out, front, W, H, colors, false)
    writeWall(out, left, L, H, colors, true)
    writeWall(out, right, L, H, colors, true)
  }
  return { positions: new Float32Array(out.positions), normals: new Float32Array(out.normals), colors: new Float32Array(out.colors) }
}

const piece = (min: [number, number, number], max: [number, number, number], tone: FrameTone): FramePiece => ({ min, max, tone })

/** Vị trí tâm các đà nóc ngang, cách đều, không trùng hai đầu thùng. */
export function roofBeamCenters(length: number): number[] {
  const count = Math.max(1, Math.round(length / ROOF_BEAM_PITCH) - 1)
  return Array.from({ length: count }, (_, i) => (length * (i + 1)) / (count + 1))
}

/**
 * Hộp đặc của khung thùng. Gờ hai bên và ngưỡng cửa có ở mọi tier (như bản trước); `detail` thêm trụ góc trước, xà dọc nóc, xà ngang
 * nóc trước / sau và đà nóc ngang — tất cả nằm ngoài lòng thùng (x ≤ 0, y ≥ H, z ≤ 0 hoặc z ≥ W) nên không chạm kiện nào.
 */
export function containerFrame({ length: L, width: W, height: H }: ContainerBox, detail: boolean): FramePiece[] {
  const t = SKIRT_THICKNESS / 2, m = FRAME_MEMBER
  const pieces = [
    piece([0, 0, -t], [L, SKIRT_HEIGHT, t], 'skirt'),
    piece([0, 0, W - t], [L, SKIRT_HEIGHT, W + t], 'skirt'),
    piece([L - t, 0, 0], [L + t, 0.06, W], 'skirt'),
  ]
  if (!detail) return pieces
  pieces.push(
    piece([-m, 0, -m], [0, H + m, 0], 'skirt'),
    piece([-m, 0, W], [0, H + m, W + m], 'skirt'),
    piece([-m, H, -m], [L, H + m, 0], 'skirt'),
    piece([-m, H, W], [L, H + m, W + m], 'skirt'),
    piece([-m, H, 0], [0, H + m, W], 'skirt'),
    piece([L - m, H, 0], [L, H + m, W], 'beam'),
    ...roofBeamCenters(L).map((x) => piece([x - ROOF_BEAM_WIDTH / 2, H, 0], [x + ROOF_BEAM_WIDTH / 2, H + ROOF_BEAM_DEPTH, W], 'beam')),
  )
  return pieces
}

/** 12 cạnh của lòng thùng, mỗi cạnh hai điểm liền nhau (cho `LineSegments`). */
export function containerEdges({ length: L, width: W, height: H }: ContainerBox): Float32Array {
  const corners = (y: number) => [[0, y, 0], [L, y, 0], [L, y, W], [0, y, W]]
  const values: number[] = []
  for (const y of [0, H]) {
    const ring = corners(y)
    ring.forEach((p, i) => values.push(...p, ...ring[(i + 1) % 4]!))
  }
  const bottom = corners(0), top = corners(H)
  bottom.forEach((p, i) => values.push(...p, ...top[i]!))
  return new Float32Array(values)
}
