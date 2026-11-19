import type { Vec3 } from './units'

/**
 * Canh khung một tập điểm ở hướng nhìn cho trước: tìm tâm nhìn và khoảng cách camera để mọi điểm nằm trong khung với lề `margin`.
 * Khác cách canh theo hộp bao của `CameraRig` ở chỗ tâm nhìn được dời trong mặt phẳng ảnh — hình không đối xứng quanh tâm thùng
 * (cabin ở một đầu, bánh ở dưới, cửa mở ở sau) vẫn nằm giữa khung thay vì để trống một nửa. Thuần, không Three.js.
 */

export type FrameFit = {
  /** Khoảng cách từ tâm nhìn tới camera, dọc `direction` */
  readonly distance: number
  /** Tâm nhìn, cùng hệ toạ độ với `points` */
  readonly target: Vec3
}

export type FrameView = {
  /** tan của nửa góc nhìn ngang và dọc */
  readonly tanHalfH: number
  readonly tanHalfV: number
  /** ≥ 1: phần khung để trống quanh hình */
  readonly margin: number
  readonly minDistance: number
}

/** Số lượt dời tâm nhìn trước lượt tính khoảng cách cuối: hai điểm xa nhất đổi sau mỗi lượt, ba lượt là đủ hội tụ. */
const PASSES = 3
const MIN_DEPTH = 1e-6

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: Vec3): Vec3 => {
  const length = Math.hypot(a[0], a[1], a[2])
  return [a[0] / length, a[1] / length, a[2] / length]
}

/**
 * Khoảng dời tâm nhìn để điểm xa nhất về hai phía của một trục màn hình cách tâm bằng nhau. `value` là toạ độ trên màn hình
 * (đã chia khoảng cách tới camera `w` của chính điểm đó); dời tâm δ đổi `value` của mỗi điểm đi δ / w.
 */
function recentre(samples: readonly { value: number; w: number }[]): number {
  let low = samples[0]!, high = low
  for (const sample of samples) {
    if (sample.value < low.value) low = sample
    if (sample.value > high.value) high = sample
  }
  return (low.value + high.value) / (1 / low.w + 1 / high.w)
}

/** `direction`: từ tâm nhìn về phía camera, không cần chuẩn hoá, không thẳng đứng tuyệt đối. */
export function fitFrame(points: readonly Vec3[], direction: Vec3, view: FrameView): FrameFit {
  const forward = unit(direction)
  const right = unit(cross([0, 1, 0], forward))
  const up = cross(forward, right)
  const projected = points.map((point) => ({ r: dot(point, right), u: dot(point, up), depth: dot(point, forward) }))
  let offsetR = 0, offsetU = 0

  const distanceAt = () => {
    let distance = view.minDistance
    for (const { r, u, depth } of projected) {
      distance = Math.max(
        distance,
        depth + Math.abs(r - offsetR) * view.margin / view.tanHalfH,
        depth + Math.abs(u - offsetU) * view.margin / view.tanHalfV,
      )
    }
    return distance
  }

  for (let pass = 0; pass < PASSES && projected.length > 0; pass++) {
    const distance = distanceAt()
    const onScreen = projected.map(({ r, u, depth }) => {
      const w = Math.max(MIN_DEPTH, distance - depth)
      return { w, r: (r - offsetR) / w, u: (u - offsetU) / w }
    })
    offsetR += recentre(onScreen.map(({ r, w }) => ({ value: r, w })))
    offsetU += recentre(onScreen.map(({ u, w }) => ({ value: u, w })))
  }

  return {
    distance: distanceAt(),
    target: [
      right[0] * offsetR + up[0] * offsetU,
      right[1] * offsetR + up[1] * offsetU,
      right[2] * offsetR + up[2] * offsetU,
    ],
  }
}

/** Lề (px) của khung hình nơi thẻ và nút nằm đè lên canvas: hình được canh vào phần còn lại. */
export type Insets = { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number }

/** Canh camera theo một tập điểm của cảnh (m, hệ góc thùng: vách trước – sàn – vách xa) trong khung đã trừ lề. */
export type FramePoints = { readonly points: readonly Vec3[]; readonly insets?: Insets }

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * Như `fitFrame` nhưng trong khung đã trừ lề `insets`: canh với nửa góc nhìn của phần khung còn lại, rồi dời camera và tâm nhìn
 * cùng nhau trong mặt phẳng ảnh cho hình nằm giữa phần đó. Khoảng dời tính ở độ sâu của tâm nhìn — điểm gần hay xa hơn lệch
 * vài px, nằm trong lề `margin`. `points` và kết quả cùng hệ toạ độ; `direction` từ tâm nhìn về phía camera.
 */
export function insetFrame(points: readonly Vec3[], direction: Vec3, view: {
  fovDeg: number; width: number; height: number; insets: Insets; margin?: number; minDistance?: number
}): { position: Vec3; target: Vec3 } {
  const { width, height, insets } = view
  const tanHalfV = Math.tan(view.fovDeg * Math.PI / 360)
  const innerW = Math.max(1, width - insets.left - insets.right), innerH = Math.max(1, height - insets.top - insets.bottom)
  const fit = fitFrame(points, direction, {
    tanHalfV: tanHalfV * innerH / height, tanHalfH: tanHalfV * innerW / height, margin: view.margin ?? 1.06, minDistance: view.minDistance ?? 3,
  })
  const forward = unit(direction)
  const right = unit(cross([0, 1, 0], forward))
  const up = cross(forward, right)
  const metresPerPx = 2 * fit.distance * tanHalfV / height
  const panRight = -(insets.left - insets.right) / 2 * metresPerPx, panUp = (insets.top - insets.bottom) / 2 * metresPerPx
  const shifted = (i: 0 | 1 | 2) => fit.target[i] + right[i] * panRight + up[i] * panUp
  const target: Vec3 = [shifted(0), shifted(1), shifted(2)]
  const position: Vec3 = [target[0] + forward[0] * fit.distance, target[1] + forward[1] * fit.distance, target[2] + forward[2] * fit.distance]
  return { position, target }
}

/** Khung vừa khít của `CameraRig` (không `framePoints`): lề quanh các góc hộp quanh xe (hệ góc thùng, từ tâm thùng); `decoration` thêm cabin, gầm, bánh. */
export const VEHICLE_FIT_MARGIN = 1.16
export function vehicleFitCorners([cx, cy, cz]: Readonly<Vec3>, decoration: boolean): Vec3[] {
  const x0 = decoration ? -1.85 : 0, y0 = decoration ? -1.15 : 0
  return [x0, cx * 2 + 1.2].flatMap((x) => [y0, cy * 2 + 0.2].flatMap((y) => [-0.45, cz * 2 + 0.45].map((z): Vec3 => [x, y, z])))
}
