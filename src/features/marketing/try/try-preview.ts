import { containerShell, createProjector, fitViewBox, roofOutline, shellColors, sortByDepth, type IsoFace, type IsoSize } from '@/lib/isometric'
import type { TryBox } from './try-request'

/**
 * Hình đẳng cự SVG của bản thử (`lib/isometric`, không Three.js — ảnh tĩnh, không xoay; AGENTS mục 7). Thuần: trả polygon, component
 * chỉ vẽ. Màu kiện không nằm ở đây — mỗi mặt mang loại mặt, CSS (`try.css`) tô theo loại kiện bằng token.
 */

const SCALE = 21
const PAD = 14
const CM_PER_M = 100
/** `containerShell` đặt gờ phía gần ở chiều sâu 1.000 để nó che mọi kiện. */
const SKIRT_DEPTH = 1000
/** Trần số kiện vẽ: ba mặt mỗi kiện, 400 kiện là 1.200 polygon — vẫn nhẹ cho một hình. Bằng trần tổng số kiện của form. */
export const PREVIEW_MAX_BOXES = 400

/** Mặt nhìn thấy của một kiện: hông (y + rộng), đầu (x + dài, phía cửa sau), nóc. */
export type BoxFaceKind = 'side' | 'front' | 'top'

export type PreviewBox = {
  readonly key: number
  readonly kind: number
  /** Thứ tự rơi vào khi hiện ra: theo thứ tự xếp của bộ tối ưu, 0 là kiện xếp đầu tiên trong số kiện được vẽ. */
  readonly step: number
  readonly faces: readonly { readonly kind: BoxFaceKind; readonly points: string }[]
}

export type TryPicture = {
  readonly viewBox: string
  /** Sàn và vách xa, vẽ trước kiện. */
  readonly back: readonly IsoFace[]
  /** Gờ thấp phía gần (y = rộng thùng), vẽ sau kiện. */
  readonly front: readonly IsoFace[]
  readonly roof: string
  readonly boxes: readonly PreviewBox[]
}

/** Lòng thùng cm → m (đơn vị của `lib/isometric`). */
export function containerSize(lengthCm: number, widthCm: number, heightCm: number): IsoSize {
  return { length: lengthCm / CM_PER_M, width: widthCm / CM_PER_M, height: heightCm / CM_PER_M }
}

/**
 * Vỏ thùng và các kiện đã xếp, sắp xa trước gần sau (gốc gần cửa sau, bên phải, trên cao vẽ sau cùng). Vượt `maxBoxes` thì giữ các kiện
 * gần người nhìn nhất vì chúng che phần còn lại.
 */
export function tryPicture(container: IsoSize, boxes: readonly TryBox[], maxBoxes = PREVIEW_MAX_BOXES): TryPicture {
  const frame = fitViewBox(container, SCALE, PAD)
  const project = createProjector(SCALE, frame.offsetX, frame.offsetY)
  const nearest = (box: TryBox) => box.x + box.length + box.y + box.width + box.z + box.height
  const kept = boxes.length > maxBoxes ? boxes.toSorted((a, b) => nearest(b) - nearest(a)).slice(0, maxBoxes) : boxes
  const steps = new Map(kept.toSorted((a, b) => a.order - b.order).map((box, step) => [box, step]))
  const drawn = kept
    .map((box, key) => ({ box, key }))
    .toSorted((a, b) => a.box.x + a.box.y + a.box.z - (b.box.x + b.box.y + b.box.z))
    .map(({ box, key }): PreviewBox => {
      const x = box.x / CM_PER_M, y = box.y / CM_PER_M, z = box.z / CM_PER_M
      const l = box.length / CM_PER_M, w = box.width / CM_PER_M, h = box.height / CM_PER_M
      return {
        key,
        kind: box.kind,
        step: steps.get(box) ?? 0,
        faces: [
          { kind: 'side', points: [project(x, y + w, z), project(x + l, y + w, z), project(x + l, y + w, z + h), project(x, y + w, z + h)].join(' ') },
          { kind: 'front', points: [project(x + l, y, z), project(x + l, y + w, z), project(x + l, y + w, z + h), project(x + l, y, z + h)].join(' ') },
          { kind: 'top', points: [project(x, y, z + h), project(x + l, y, z + h), project(x + l, y + w, z + h), project(x, y + w, z + h)].join(' ') },
        ],
      }
    })
  const shell = sortByDepth(containerShell(container, project, shellColors()))
  return {
    viewBox: frame.viewBox,
    back: shell.filter((face) => face.depth < SKIRT_DEPTH),
    front: shell.filter((face) => face.depth >= SKIRT_DEPTH),
    roof: roofOutline(container, project),
    boxes: drawn,
  }
}
