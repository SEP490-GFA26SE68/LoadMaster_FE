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

/**
 * Phép chiếu song song nhìn theo `direction` — hướng từ tâm nhìn tới camera trong hệ của khung 3D (x dọc thùng, y lên, z ngang), cùng
 * cơ sở phải / lên với `fitFrame` của viewer3d: hình SVG đứng đúng góc của khung 3D. Đầu vào theo quy ước của file này (x dài, y ngang,
 * z cao), tức điểm (x, z, y) của khung 3D. `alongPoint` trả toạ độ màn chưa nhân tỉ lệ (y hướng xuống) để tính khung nhìn.
 */
export function alongPoint(direction: readonly [number, number, number], x: number, y: number, z: number): [number, number] {
  const [dx, dy, dz] = direction
  const length = Math.hypot(dx, dy, dz) || 1
  const fx = dx / length, fy = dy / length, fz = dz / length
  const across = Math.hypot(fx, fz) || 1
  const rx = fz / across, rz = -fx / across
  return [x * rx + y * rz, -(x * fy * rz + z * (fz * rx - fx * rz) - y * fy * rx)]
}

export function projectAlong(direction: readonly [number, number, number], scale: number, offsetX = 0, offsetY = 0): Projector {
  return (x, y, z) => {
    const [px, py] = alongPoint(direction, x, y, z)
    return `${(px * scale + offsetX).toFixed(1)},${(py * scale + offsetY).toFixed(1)}`
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

/** Ba mặt nhìn thấy của một khối hộp: trái tối, phải vừa, đỉnh sáng. */
export function boxFaces(
  box: IsoBox,
  project: Projector,
  options: { stroke?: string; strokeWidth?: number; topTint?: number } = {},
): IsoFace[] {
  const { x, y, z, length: l, width: w, height: h, color } = box
  const stroke = options.stroke ?? 'rgba(0,0,0,.3)'
  const strokeWidth = options.strokeWidth ?? 0.6
  const depth = x + y + z

  return [
    {
      points: [project(x, y + w, z), project(x + l, y + w, z), project(x + l, y + w, z + h), project(x, y + w, z + h)].join(' '),
      fill: shade(color, 0.62),
      stroke,
      strokeWidth,
      depth,
    },
    {
      points: [project(x + l, y, z), project(x + l, y + w, z), project(x + l, y + w, z + h), project(x + l, y, z + h)].join(' '),
      fill: shade(color, 0.82),
      stroke,
      strokeWidth,
      depth,
    },
    {
      points: [project(x, y, z + h), project(x + l, y, z + h), project(x + l, y + w, z + h), project(x, y + w, z + h)].join(' '),
      fill: options.topTint ? tint(color, options.topTint) : color,
      stroke,
      strokeWidth,
      depth,
    },
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
  const { length: l, width: w, height: h } = size
  const stroke = options.stroke ?? 'rgba(255,255,255,.14)'
  const strokeWidth = options.strokeWidth ?? 0.8
  const skirt = options.skirtHeight ?? 0.25

  return [
    { points: [project(0, 0, 0), project(l, 0, 0), project(l, w, 0), project(0, w, 0)].join(' '), fill: colors.floor, stroke, strokeWidth, depth: -3 },
    { points: [project(0, 0, 0), project(0, w, 0), project(0, w, h), project(0, 0, h)].join(' '), fill: colors.farWall, stroke, strokeWidth, depth: -2 },
    { points: [project(0, 0, 0), project(l, 0, 0), project(l, 0, h), project(0, 0, h)].join(' '), fill: colors.sideWall, stroke, strokeWidth, depth: -2 },
    { points: [project(0, w, 0), project(l, w, 0), project(l, w, skirt), project(0, w, skirt)].join(' '), fill: colors.skirt, stroke, strokeWidth: 0.6, depth: 1000 },
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
