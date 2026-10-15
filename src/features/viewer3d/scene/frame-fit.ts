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
