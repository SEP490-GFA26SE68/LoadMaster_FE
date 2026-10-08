import type { VehicleConfig } from '@/domain/models'

/** Một mốc chung cho mọi dòng của danh sách: xe dài hơn thì hình dài hơn, so được bằng mắt (V2.3, DoiXe.jpg). */
export const TOP_VIEW_PX_PER_CM = 0.14
/** Bề dày vạch cửa sau và cạnh nhỏ nhất của vật cản, để vật cản mỏng vẫn thấy được trên hình nhỏ. */
export const TOP_VIEW_DOOR_PX = 2
export const TOP_VIEW_MIN_PX = 1.5

export type TopViewRect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export type TopView = {
  readonly width: number
  readonly height: number
  readonly obstacles: readonly TopViewRect[]
  /** Cạnh cửa sau — mép bên phải của hình, vì vách đầu thùng ở x = 0 (cùng hệ toạ độ với vật cản). */
  readonly door: TopViewRect
}

const round = (value: number) => Math.round(value * 10) / 10

/**
 * Hình lòng thùng nhìn từ trên (trục x dọc theo thùng, y ngang thùng — đúng hệ toạ độ của vật cản), pixel theo `scale`.
 * Thuần hình học từ dữ liệu xe, không có số nào ngoài kích thước thùng và vị trí vật cản đã khai.
 */
export function topViewOf(
  vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm' | 'obstacles'>,
  scale = TOP_VIEW_PX_PER_CM,
): TopView {
  const width = round(vehicle.innerLengthCm * scale)
  const height = round(vehicle.innerWidthCm * scale)
  return {
    width,
    height,
    obstacles: vehicle.obstacles.map((obstacle) => ({
      x: round(obstacle.xCm * scale),
      y: round(obstacle.yCm * scale),
      width: round(Math.max(obstacle.lengthCm * scale, TOP_VIEW_MIN_PX)),
      height: round(Math.max(obstacle.widthCm * scale, TOP_VIEW_MIN_PX)),
    })),
    door: { x: round(width - TOP_VIEW_DOOR_PX), y: 0, width: TOP_VIEW_DOOR_PX, height },
  }
}
