/**
 * Vị trí của khung chat trợ lý khi người dùng kéo nó đi (từ 768 px, khung không modal) — hàm thuần, px của khung nhìn. Khung luôn nằm trọn
 * trong khung nhìn: cách mép trái, phải, dưới ít nhất `PANEL_EDGE_MIN`, đỉnh không lên trên `topInset` (đáy thanh điều hướng / đầu trang /
 * thanh dải trời cộng khe). Thả cách một mép không quá `PANEL_SNAP` thì khung hút vào lề của mép đó (`PANEL_GUTTER` — cùng lề với chỗ mặc
 * định; mép trên là `topInset`). Vị trí lưu theo **mép gần nhất** (`PanelPlacement`): đổi cỡ cửa sổ, phóng to / thu nhỏ thì khung vẫn bám
 * góc người dùng chọn.
 */
export const PANEL_EDGE_MIN = 8
export const PANEL_GUTTER = 24
export const PANEL_SNAP = 24
/** Bước dời bằng phím mũi tên; giữ Shift là bước lớn. */
export const PANEL_STEP = 16
export const PANEL_STEP_LARGE = 64

export type PanelPlacement = {
  readonly x: 'left' | 'right'
  /** Khoảng cách tới mép `x` của khung nhìn (px). */
  readonly dx: number
  readonly y: 'top' | 'bottom'
  /** Khoảng cách tới mép `y` của khung nhìn (px). */
  readonly dy: number
}

export type PanelPoint = { readonly left: number; readonly top: number }
export type PanelSize = { readonly width: number; readonly height: number }
export type PanelBounds = {
  readonly viewport: PanelSize
  /** Đỉnh khung không lên trên dòng này (px tính từ mép trên khung nhìn). */
  readonly topInset: number
}

function clampAxis(value: number, min: number, max: number): number {
  // Khung to hơn chỗ trống: bám mép đầu (trái / trên) để đầu khung — nơi có nút đóng — luôn thấy được
  return max < min ? min : Math.min(Math.max(value, min), max)
}

/** Kẹp vị trí để khung nằm trọn trong khung nhìn, dưới `topInset`. */
export function clampPosition(point: PanelPoint, size: PanelSize, bounds: PanelBounds): PanelPoint {
  const { viewport, topInset } = bounds
  return {
    left: clampAxis(point.left, PANEL_EDGE_MIN, viewport.width - PANEL_EDGE_MIN - size.width),
    top: clampAxis(point.top, topInset, viewport.height - PANEL_EDGE_MIN - size.height),
  }
}

/** Vị trí lúc thả: kẹp, hút vào lề của mép nào cách không quá `PANEL_SNAP`, rồi kẹp lại. */
export function snapPosition(point: PanelPoint, size: PanelSize, bounds: PanelBounds): PanelPoint {
  const { viewport, topInset } = bounds
  const clamped = clampPosition(point, size, bounds)
  let { left, top } = clamped
  const right = viewport.width - left - size.width
  const bottom = viewport.height - top - size.height
  if (left <= PANEL_SNAP) left = PANEL_GUTTER
  else if (right <= PANEL_SNAP) left = viewport.width - PANEL_GUTTER - size.width
  if (top - topInset <= PANEL_SNAP) top = topInset
  else if (bottom <= PANEL_SNAP) top = viewport.height - PANEL_GUTTER - size.height
  return clampPosition({ left, top }, size, bounds)
}

/** Vị trí theo mép gần nhất của mỗi chiều (hoà thì phải, dưới — như chỗ mặc định). */
export function placementOf(point: PanelPoint, size: PanelSize, viewport: PanelSize): PanelPlacement {
  const right = viewport.width - point.left - size.width
  const bottom = viewport.height - point.top - size.height
  return {
    x: point.left < right ? 'left' : 'right',
    dx: Math.round(point.left < right ? point.left : right),
    y: point.top < bottom ? 'top' : 'bottom',
    dy: Math.round(point.top < bottom ? point.top : bottom),
  }
}

/** Góc trên trái của khung từ vị trí đã lưu. */
export function positionOf(placement: PanelPlacement, size: PanelSize, viewport: PanelSize): PanelPoint {
  return {
    left: placement.x === 'left' ? placement.dx : viewport.width - placement.dx - size.width,
    top: placement.y === 'top' ? placement.dy : viewport.height - placement.dy - size.height,
  }
}

/** Vị trí đã lưu, kẹp vào khung nhìn hiện tại mà vẫn giữ mép neo (đổi cỡ cửa sổ không làm mất góc người dùng chọn). */
export function fitPlacement(placement: PanelPlacement, size: PanelSize, bounds: PanelBounds): PanelPlacement {
  const point = clampPosition(positionOf(placement, size, bounds.viewport), size, bounds)
  const { width, height } = bounds.viewport
  return {
    x: placement.x,
    dx: Math.round(placement.x === 'left' ? point.left : width - point.left - size.width),
    y: placement.y,
    dy: Math.round(placement.y === 'top' ? point.top : height - point.top - size.height),
  }
}

/** Dời bằng phím từ vị trí hiện tại (đã kẹp, không hút — người dùng phím chọn từng bước). */
export function nudgePosition(point: PanelPoint, size: PanelSize, bounds: PanelBounds, delta: PanelPoint): PanelPoint {
  return clampPosition({ left: point.left + delta.left, top: point.top + delta.top }, size, bounds)
}
