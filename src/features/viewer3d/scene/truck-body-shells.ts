import type { TruckBodyStyle } from '@/types/vehicle-body-style'
import { boardHeight, evenCenters, headboardHeight } from './body-pieces'
import {
  containerShell, PLANK_WIDTH, QuadWriter, scale, type ContainerBox, type Face, type Rgb, type ShellColors, type ShellGeometry,
} from './container-structure'

/**
 * Vỏ trong của bốn thân xe tải (hệ góc thùng, đơn vị scene): mọi mặt đơn, pháp tuyến hướng vào lòng thùng (sàn hướng lên, nóc bạt
 * hướng xuống), nên mặt gần camera tự biến mất và nhìn từ trên luôn thấy hàng. Ván, bạt, gân, vạch nối chỉ là màu đỉnh trên chính mặt
 * đó — **không nhô** vào lòng thùng. `detail` tắt (tier low): mỗi phần một ô một màu. Một lưới, một draw call. Thuần, không Three.js.
 *
 * - Thùng kín: `containerShell` (sàn ván, vách sóng tôn).
 * - Mui bạt: sàn ván, thành thấp bằng ván (`boardHeight`), phía trên là bạt ở hai bên, vách trước và nóc — vệt sáng ở chỗ khung mui.
 * - Lửng: sàn ván, thành thấp ở hai bên, tấm chắn đầu (`headboardHeight`) ở vách trước; không nóc.
 * - Đông lạnh: sàn nhôm có rãnh, vách cách nhiệt trắng phẳng có nẹp chân, nẹp trên và vạch nối tấm.
 */
export type BodyShellColors = ShellColors & { readonly tarp: Rgb; readonly insulated: Rgb; readonly metal: Rgb }

type Bands = { from: number; to: number; color: Rgb }[]

/** Khung mui bạt cách nhau chừng này. */
export const BOW_PITCH = 1
const BOW_BAND = 0.05
const BOARD_ROW = 0.15
const HEM = 0.06
/** Nẹp chân (tấm chống va) và vạch nối tấm của vách đông lạnh. */
const KICK_PLATE = 0.3
const SEAM = 0.02
const SEAM_PITCH = 1

function faces(W: number, H: number) {
  return {
    floor: { origin: [0, 0, 0], u: [0, 0, 1], v: [1, 0, 0], normal: [0, 1, 0] } as Face,
    front: { origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], normal: [1, 0, 0] } as Face,
    left: { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1] } as Face,
    right: { origin: [0, 0, W], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, -1] } as Face,
    roof: { origin: [0, H, 0], u: [0, 0, 1], v: [1, 0, 0], normal: [0, -1, 0] } as Face,
  }
}

/** Chia [from, to] thành các dải màu xen kẽ bước `pitch`, dải cuối hẹp hơn để vừa đúng. */
function alternating(from: number, to: number, pitch: number, a: Rgb, b: Rgb): Bands {
  const bands: Bands = []
  for (let v = from, i = 0; v < to - 1e-6; v += pitch, i++) bands.push({ from: v, to: Math.min(to, v + pitch), color: i % 2 ? b : a })
  return bands
}

/** Dải đều có vạch hẹp tại các tâm `centers` (khung mui, vạch nối tấm) trên nền `base`. */
function marked(span: number, centers: number[], width: number, base: Rgb, mark: Rgb): Bands {
  const bands: Bands = []
  let v = 0
  for (const c of centers) {
    bands.push({ from: v, to: c - width / 2, color: base }, { from: c - width / 2, to: c + width / 2, color: mark })
    v = c + width / 2
  }
  bands.push({ from: v, to: span, color: base })
  return bands
}

/** Lưới ô trên một mặt: cột theo u, hàng theo v; màu ô là màu hàng, trừ khi cột có màu riêng (`columnWins`). */
function grid(out: QuadWriter, face: Face, columns: Bands, rows: Bands, columnWins: (row: Bands[number]) => boolean) {
  for (const row of rows) {
    for (const column of columns) out.quad(face, column.from, column.to, row.from, row.to, columnWins(row) ? column.color : row.color)
  }
}

function planks(out: QuadWriter, floor: Face, W: number, L: number, c: BodyShellColors) {
  for (const band of alternating(0, W, PLANK_WIDTH, c.floor, scale(c.floor, 0.95))) out.quad(floor, band.from, band.to, 0, L, band.color)
}

/** Thành ván: các ván ngang xen hai sắc, nẹp trên ở mép thành. */
function boardRows(height: number, c: BodyShellColors): Bands {
  return [...alternating(0, height - 0.05, BOARD_ROW, c.wall, scale(c.wall, 1.08)), { from: height - 0.05, to: height, color: c.trim }]
}

function canvasShell(out: QuadWriter, f: ReturnType<typeof faces>, { length: L, width: W, height: H }: ContainerBox, c: BodyShellColors) {
  const board = boardHeight(H)
  const bows = evenCenters(L, BOW_PITCH)
  const tarpRows: Bands = [
    { from: board, to: board + HEM, color: scale(c.tarp, 0.78) },
    { from: board + HEM, to: H - 0.05, color: c.tarp },
    { from: H - 0.05, to: H, color: scale(c.tarp, 0.9) },
  ].filter((row) => row.to > row.from)
  const isTarp = (row: Bands[number]) => row.color === c.tarp
  planks(out, f.floor, W, L, c)
  const sideBows = marked(L, bows, BOW_BAND, c.tarp, scale(c.tarp, 1.14))
  for (const side of [f.left, f.right]) {
    grid(out, side, [{ from: 0, to: L, color: c.wall }], boardRows(board, c), () => false)
    grid(out, side, sideBows, tarpRows, isTarp)
  }
  grid(out, f.front, [{ from: 0, to: W, color: c.wall }], [...boardRows(board, c), ...tarpRows], () => false)
  // Nóc bạt: u theo bề rộng, v dọc thùng — vệt sáng dưới từng khung mui
  for (const band of marked(L, bows, BOW_BAND, scale(c.tarp, 0.92), scale(c.tarp, 1.14))) out.quad(f.roof, 0, W, band.from, band.to, band.color)
}

function flatbedShell(out: QuadWriter, f: ReturnType<typeof faces>, { length: L, width: W, height: H }: ContainerBox, c: BodyShellColors) {
  const board = boardHeight(H), head = headboardHeight(H)
  planks(out, f.floor, W, L, c)
  for (const side of [f.left, f.right]) grid(out, side, [{ from: 0, to: L, color: c.wall }], boardRows(board, c), () => false)
  grid(out, f.front, [{ from: 0, to: W, color: c.wall }], boardRows(board, c), () => false)
  if (head > board + 1e-6) {
    // Tấm chắn đầu trên thành: tôn có gân đứng, nẹp trên
    const ribs = alternating(0, W, 0.12, c.trim, scale(c.trim, 0.86))
    grid(out, f.front, ribs, [{ from: board, to: head - 0.05, color: c.trim }, { from: head - 0.05, to: head, color: c.metal }], (row) => row.color === c.trim)
  }
}

function reeferShell(out: QuadWriter, f: ReturnType<typeof faces>, { length: L, width: W, height: H }: ContainerBox, c: BodyShellColors) {
  // Sàn nhôm có rãnh dọc thùng
  for (const band of alternating(0, W, 0.05, c.metal, scale(c.metal, 0.82))) out.quad(f.floor, band.from, band.to, 0, L, band.color)
  const kick = Math.min(KICK_PLATE, H * 0.2)
  const rows: Bands = [
    { from: 0, to: kick, color: scale(c.metal, 0.92) },
    { from: kick, to: H - 0.08, color: c.insulated },
    { from: H - 0.08, to: H, color: scale(c.metal, 0.95) },
  ]
  const panelRows = (row: Bands[number]) => row.color === c.insulated
  for (const side of [f.left, f.right]) grid(out, side, marked(L, evenCenters(L, SEAM_PITCH), SEAM, c.insulated, scale(c.insulated, 0.9)), rows, panelRows)
  grid(out, f.front, marked(W, evenCenters(W, SEAM_PITCH), SEAM, c.insulated, scale(c.insulated, 0.9)), rows, panelRows)
}

/** Bản gọn (tier low): sàn một ô, mỗi vách một hay hai ô (thành / bạt), nóc bạt một ô. */
function simpleShell(out: QuadWriter, body: TruckBodyStyle, f: ReturnType<typeof faces>, { length: L, width: W, height: H }: ContainerBox, c: BodyShellColors) {
  const board = boardHeight(H)
  const floor = body === 'TRUCK_REEFER' ? c.metal : c.floor
  const wall = body === 'TRUCK_REEFER' ? c.insulated : c.wall
  out.quad(f.floor, 0, W, 0, L, floor)
  const top = body === 'TRUCK_FLATBED' ? board : H
  const lower = body === 'TRUCK_CANVAS' ? board : top
  for (const [face, span] of [[f.left, L], [f.right, L], [f.front, W]] as const) {
    out.quad(face, 0, span, 0, lower, wall)
    if (body === 'TRUCK_CANVAS') out.quad(face, 0, span, board, H, c.tarp)
  }
  if (body === 'TRUCK_FLATBED') out.quad(f.front, 0, W, board, headboardHeight(H), c.trim)
  if (body === 'TRUCK_CANVAS') out.quad(f.roof, 0, W, 0, L, scale(c.tarp, 0.92))
}

export function truckBodyShell(body: TruckBodyStyle, box: ContainerBox, colors: BodyShellColors, detail: boolean): ShellGeometry {
  if (body === 'TRUCK_BOX') return containerShell(box, colors, detail)
  const out = new QuadWriter()
  const f = faces(box.width, box.height)
  if (!detail) simpleShell(out, body, f, box, colors)
  else if (body === 'TRUCK_CANVAS') canvasShell(out, f, box, colors)
  else if (body === 'TRUCK_FLATBED') flatbedShell(out, f, box, colors)
  else reeferShell(out, f, box, colors)
  return { positions: new Float32Array(out.positions), normals: new Float32Array(out.normals), colors: new Float32Array(out.colors) }
}
