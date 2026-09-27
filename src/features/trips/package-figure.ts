import { boxFaces, sortByDepth, type IsoFace } from '@/lib/isometric'

/**
 * Hình đẳng cự của một kiện ở đầu panel kiện (V2.3 `ChiTietChuyenKien`): ba mặt theo đúng tỉ lệ D × R × C (không theo vị trí xếp),
 * bóng nền, băng keo trên nắp và ba đường kích thước có nhãn "D", "R", "C". Hàm thuần: chỉ tính toạ độ, component tự vẽ và dịch nhãn.
 */

const COS_30 = Math.cos(Math.PI / 6)
/** Khung cố định 146 × 120 như bản mẫu; lề trái chừa chỗ nhãn C, lề dưới cho nhãn D và R. */
export const FIGURE_WIDTH = 146
export const FIGURE_HEIGHT = 120
const PAD = { left: 30, right: 14, top: 4, bottom: 22 }
/** Đường kích thước cách cạnh hộp, px. */
const DIM_GAP = 7

export type Point = { readonly x: number; readonly y: number }
export type DimensionLine = {
  readonly axis: 'length' | 'width' | 'height'
  readonly valueCm: number
  readonly from: Point
  readonly to: Point
  /** Hai đường gióng nét đứt từ góc hộp ra đường kích thước. */
  readonly extensions: readonly (readonly [Point, Point])[]
  readonly label: Point
  readonly anchor: 'start' | 'end'
}
export type PackageFigure = {
  readonly faces: readonly IsoFace[]
  readonly shadow: string
  readonly tape: readonly [Point, Point]
  readonly dimensions: readonly DimensionLine[]
}

const round = (value: number) => Math.round(value * 10) / 10
const point = (x: number, y: number): Point => ({ x: round(x), y: round(y) })
const toString = (p: Point) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`
/** Dời một điểm theo hướng (dx, dy) đã chuẩn hoá, `distance` px. */
function shift(p: Point, dx: number, dy: number, distance: number): Point {
  const length = Math.hypot(dx, dy) || 1
  return point(p.x + (dx / length) * distance, p.y + (dy / length) * distance)
}

export function packageFigure(size: { lengthCm: number; widthCm: number; heightCm: number }, color: string): PackageFigure {
  const l = Math.max(size.lengthCm, 0.1)
  const w = Math.max(size.widthCm, 0.1)
  const h = Math.max(size.heightCm, 0.1)
  const areaW = FIGURE_WIDTH - PAD.left - PAD.right
  const areaH = FIGURE_HEIGHT - PAD.top - PAD.bottom
  const scale = Math.min(areaW / ((l + w) * COS_30), areaH / ((l + w) / 2 + h))
  const boxW = (l + w) * COS_30 * scale
  const boxH = ((l + w) / 2 + h) * scale
  const offsetX = PAD.left + (areaW - boxW) / 2 + w * COS_30 * scale
  const offsetY = PAD.top + (areaH - boxH) / 2 + h * scale
  const at = (x: number, y: number, z: number) => point((x - y) * COS_30 * scale + offsetX, (x + y) * 0.5 * scale - z * scale + offsetY)

  const faces = sortByDepth(boxFaces(
    { x: 0, y: 0, z: 0, length: l, width: w, height: h, color },
    (x, y, z) => toString(at(x, y, z)),
    { stroke: 'rgba(0,0,0,.22)', strokeWidth: 0.8, topTint: 0.3 },
  ))
  // Bóng nền: đáy hộp nới 8 % và lệch về phía trước
  const pad = 0.08 * Math.max(l, w)
  const shadow = [at(-pad, -pad * 0.4, 0), at(l + pad, -pad * 0.4, 0), at(l + pad, w + pad, 0), at(-pad, w + pad, 0)]
    .map((p) => toString(point(p.x, p.y + 3))).join(' ')

  // D chạy theo cạnh dưới mặt trái (y = w), R theo cạnh dưới mặt phải (x = l), C dựng đứng ở góc trái
  const leftBottom = [at(0, w, 0), at(l, w, 0)] as const
  const rightBottom = [at(l, w, 0), at(l, 0, 0)] as const
  const outLeft = { dx: -COS_30, dy: 0.5 }
  const outRight = { dx: COS_30, dy: 0.5 }
  const dFrom = shift(leftBottom[0], outLeft.dx, outLeft.dy, DIM_GAP)
  const dTo = shift(leftBottom[1], outLeft.dx, outLeft.dy, DIM_GAP)
  const rFrom = shift(rightBottom[0], outRight.dx, outRight.dy, DIM_GAP)
  const rTo = shift(rightBottom[1], outRight.dx, outRight.dy, DIM_GAP)
  const cBottom = at(0, w, 0)
  const cTop = at(0, w, h)
  const cX = cBottom.x - DIM_GAP
  const mid = (a: Point, b: Point) => point((a.x + b.x) / 2, (a.y + b.y) / 2)
  const dMid = mid(dFrom, dTo)
  const rMid = mid(rFrom, rTo)

  return {
    faces,
    shadow,
    tape: [at(l / 2, 0, h), at(l / 2, w, h)],
    dimensions: [
      {
        axis: 'length', valueCm: size.lengthCm, from: dFrom, to: dTo,
        extensions: [[leftBottom[0], shift(leftBottom[0], outLeft.dx, outLeft.dy, DIM_GAP + 2)], [leftBottom[1], shift(leftBottom[1], outLeft.dx, outLeft.dy, DIM_GAP + 2)]],
        label: point(dMid.x - 3, dMid.y + 12), anchor: 'end',
      },
      {
        axis: 'width', valueCm: size.widthCm, from: rFrom, to: rTo,
        extensions: [[rightBottom[0], shift(rightBottom[0], outRight.dx, outRight.dy, DIM_GAP + 2)], [rightBottom[1], shift(rightBottom[1], outRight.dx, outRight.dy, DIM_GAP + 2)]],
        label: point(rMid.x + 3, rMid.y + 12), anchor: 'start',
      },
      {
        axis: 'height', valueCm: size.heightCm, from: point(cX, cBottom.y), to: point(cX, cTop.y),
        extensions: [[cBottom, point(cX - 2, cBottom.y)], [cTop, point(cX - 2, cTop.y)]],
        label: point(cX - 4, (cBottom.y + cTop.y) / 2 + 4), anchor: 'end',
      },
    ],
  }
}
