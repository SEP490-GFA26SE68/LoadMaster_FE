import { readToken } from './tokens'

/**
 * Phép chiếu đẳng cự cho ảnh xem trước dạng SVG (modal tối ưu, thẻ so sánh
 * phương án). Không phải viewer 3D — không đụng `three` (AGENTS.md mục 7).
 * Đơn vị đầu vào là mét; đầu ra là toạ độ SVG.
 */

export type IsoBox = {
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  color: string
}

export type IsoFace = {
  points: string
  fill: string
  stroke: string
  strokeWidth: number
  /** Khoá sắp xếp theo chiều sâu, vẽ xa trước gần sau. */
  depth: number
}

export type IsoSize = { length: number; width: number; height: number }

/** Hộp không màu: chỉ hình học, cho hình tô màu bằng class token thay vì mã hex (hộp thoại chạy tối ưu). */
export type IsoBounds = Omit<IsoBox, 'color'>

/** Ba mặt nhìn thấy của một hộp sau phép chiếu: `left` là mặt y + width, `right` là mặt x + length, `top` là nóc. */
export type IsoBoxFacePoints = { left: string; right: string; top: string }

/** Các mặt của vỏ thùng sau phép chiếu: sàn, vách trước (x = 0), vách trái (y = 0) và gờ thấp bên phải (y = W). */
export type IsoShellFacePoints = { floor: string; farWall: string; sideWall: string; skirt: string }

export type Projector = (x: number, y: number, z: number) => string

const COS_30 = Math.cos(Math.PI / 6)

export function createProjector(
  scale: number,
  offsetX = 0,
  offsetY = 0,
): Projector {
  return (x, y, z) => {
    const px = (x - y) * COS_30 * scale + offsetX
    const py = (x + y) * 0.5 * scale - z * scale + offsetY
    return `${px.toFixed(1)},${py.toFixed(1)}`
  }
}

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(rgb: number[]): string {
  return `#${rgb
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/** Làm tối theo hệ số k (0–1). */
export function shade(hex: string, k: number): string {
  return toHex(channels(hex).map((v) => v * k))
}

/** Pha trắng theo tỉ lệ k (0–1). */
export function tint(hex: string, k: number): string {
  return toHex(channels(hex).map((v) => v + (255 - v) * k))
}

/** Toạ độ ba mặt nhìn thấy của một hộp — phần hình học chung của `boxFaces` và của hình tô màu bằng class. */
export function boxFacePoints(box: IsoBounds, project: Projector): IsoBoxFacePoints {
  const { x, y, z, length: l, width: w, height: h } = box
  return {
    left: [project(x, y + w, z), project(x + l, y + w, z), project(x + l, y + w, z + h), project(x, y + w, z + h)].join(' '),
    right: [project(x + l, y, z), project(x + l, y + w, z), project(x + l, y + w, z + h), project(x + l, y, z + h)].join(' '),
    top: [project(x, y, z + h), project(x + l, y, z + h), project(x + l, y + w, z + h), project(x, y + w, z + h)].join(' '),
  }
}

/** Ba mặt nhìn thấy của một khối hộp: trái tối, phải vừa, đỉnh sáng. */
export function boxFaces(
  box: IsoBox,
  project: Projector,
  options: { stroke?: string; strokeWidth?: number; topTint?: number } = {},
): IsoFace[] {
  const { x, y, z, color } = box
  const stroke = options.stroke ?? 'rgba(0,0,0,.3)'
  const strokeWidth = options.strokeWidth ?? 0.6
  const depth = x + y + z
  const points = boxFacePoints(box, project)

  return [
    { points: points.left, fill: shade(color, 0.62), stroke, strokeWidth, depth },
    { points: points.right, fill: shade(color, 0.82), stroke, strokeWidth, depth },
    { points: points.top, fill: options.topTint ? tint(color, options.topTint) : color, stroke, strokeWidth, depth },
  ]
}

export function sortByDepth(faces: IsoFace[]): IsoFace[] {
  return [...faces].sort((a, b) => a.depth - b.depth)
}

/** Màu vỏ thùng suy từ token vùng 3D. */
export function shellColors() {
  const base = readToken('--border-dark') || '#2d323b'
  return {
    floor: tint(base, 0.12),
    farWall: base,
    sideWall: tint(base, 0.06),
    skirt: tint(base, 0.32),
  }
}

/** Toạ độ các mặt của vỏ thùng; `skirtHeight` là chiều cao gờ bên phải (mét). */
export function shellFacePoints(size: IsoSize, project: Projector, skirtHeight = 0.25): IsoShellFacePoints {
  const { length: l, width: w, height: h } = size
  return {
    floor: [project(0, 0, 0), project(l, 0, 0), project(l, w, 0), project(0, w, 0)].join(' '),
    farWall: [project(0, 0, 0), project(0, w, 0), project(0, w, h), project(0, 0, h)].join(' '),
    sideWall: [project(0, 0, 0), project(l, 0, 0), project(l, 0, h), project(0, 0, h)].join(' '),
    skirt: [project(0, w, 0), project(l, w, 0), project(l, w, skirtHeight), project(0, w, skirtHeight)].join(' '),
  }
}

/**
 * Sàn, vách trước (x=0), vách trái (y=0) và gờ thấp bên phải (y=W)
 * để thùng có hình khối mà hàng bên trong vẫn nhìn thấy.
 */
export function containerShell(
  size: IsoSize,
  project: Projector,
  colors: ReturnType<typeof shellColors>,
  options: { stroke?: string; strokeWidth?: number; skirtHeight?: number } = {},
): IsoFace[] {
  const stroke = options.stroke ?? 'rgba(255,255,255,.14)'
  const strokeWidth = options.strokeWidth ?? 0.8
  const points = shellFacePoints(size, project, options.skirtHeight)

  return [
    { points: points.floor, fill: colors.floor, stroke, strokeWidth, depth: -3 },
    { points: points.farWall, fill: colors.farWall, stroke, strokeWidth, depth: -2 },
    { points: points.sideWall, fill: colors.sideWall, stroke, strokeWidth, depth: -2 },
    { points: points.skirt, fill: colors.skirt, stroke, strokeWidth: 0.6, depth: 1000 },
  ]
}

/** Viền nóc thùng (hình chữ nhật trên cùng). */
export function roofOutline(size: IsoSize, project: Projector): string {
  const { length: l, width: w, height: h } = size
  return [project(0, 0, h), project(l, 0, h), project(l, w, h), project(0, w, h), project(0, 0, h)].join(' ')
}

/** Bóng đổ mềm dưới thùng, hơi rộng hơn đáy. */
export function groundShadow(size: IsoSize, project: Projector, pad = 0.3): string {
  const { length: l, width: w } = size
  return [project(-pad, -pad, -0.05), project(l + pad, -pad, -0.05), project(l + pad, w + pad, -0.05), project(-pad, w + pad, -0.05)].join(' ')
}

/**
 * Khung nhìn vừa khít một thùng hàng sau phép chiếu.
 *
 * Đặt viewBox bằng số ước lượng là cách hình bị cắt mất đáy: sau phép chiếu,
 * chiều cao của thùng là (L+W)/2 + H chứ không phải H, nên thùng càng dài thì
 * càng chiếm nhiều chiều dọc — 7,2 m dài cho ra 459px ở scale 64, gấp ba lần
 * con số người ta hay đoán. Tính thẳng từ hình học thì đổi `scale` bao nhiêu
 * cũng không lệch.
 *
 * Truyền `offsetX`/`offsetY` vào `createProjector` để gốc toạ độ dịch vào
 * trong khung; không cần bọc thêm `<g transform>`.
 */
export function fitViewBox(size: IsoSize, scale: number, pad = 0) {
  const { length: l, width: w, height: h } = size
  const width = (l + w) * COS_30 * scale + pad * 2
  const height = ((l + w) / 2 + h) * scale + pad * 2
  return {
    viewBox: `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`,
    width,
    height,
    offsetX: w * COS_30 * scale + pad,
    offsetY: h * scale + pad,
  }
}
