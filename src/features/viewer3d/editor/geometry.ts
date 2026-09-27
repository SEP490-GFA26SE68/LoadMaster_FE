import type { PositionCm } from '@/features/viewer3d/scene-input'
import type { VehicleConfig, VehicleObstacle } from '@/domain/models'
import { lt, roundCm } from '@/domain/geometry'

export type Axis = keyof PositionCm
export const AXES: readonly Axis[] = ['x', 'y', 'z']
export const EDITOR_RULES = Object.freeze({
  gridCm: 5, snapThresholdCm: 2,
  historyLimit: 200,
})
/** LM-034: nút dịch chuyển đi đúng 1, 5 hoặc 10 cm. */
export const EDITOR_NUDGE_STEPS_CM = [1, 5, 10] as const

/** Hộp cm theo tên trường scene: kiện hoặc vật cản. */
export type EditorBox = { readonly position: PositionCm; readonly lengthCm: number; readonly widthCm: number; readonly heightCm: number }

export const extent = (p: EditorBox, axis: Axis) =>
  axis === 'x' ? p.lengthCm : axis === 'y' ? p.widthCm : p.heightCm
export const limit = (v: VehicleConfig, axis: Axis) =>
  axis === 'x' ? v.innerLengthCm : axis === 'y' ? v.innerWidthCm : v.innerHeightCm
/** So qua EPSILON: 100,4 + 120,7 = 221,10000000000002 vẫn là chạm mặt kiện ở 221,1, không phải chồng lấn. */
export const overlapsAxis = (a: EditorBox, b: EditorBox, axis: Axis) =>
  lt(a.position[axis], b.position[axis] + extent(b, axis)) &&
  lt(b.position[axis], a.position[axis] + extent(a, axis))
export const overlaps = (a: EditorBox, b: EditorBox) => AXES.every((axis) => overlapsAxis(a, b, axis))
/** Editor commit đi qua `roundCm` (bội 0,1 cm) tại biên, không làm tròn giữa gesture. */
export const roundPosition = (p: PositionCm): { x: number; y: number; z: number } =>
  ({ x: roundCm(p.x), y: roundCm(p.y), z: roundCm(p.z) })
export const obstacleBox = ({ id, xCm, yCm, zCm, lengthCm, widthCm, heightCm }: VehicleObstacle): EditorBox & { id: string } =>
  ({ id, position: { x: xCm, y: yCm, z: zCm }, lengthCm, widthCm, heightCm })

/**
 * Kết quả kiểm một tư thế đã dịch sang câu cho UI (LM-035): lỗi chặn commit, cảnh báo vẫn commit.
 * Tính hợp lệ do constraint engine của domain quyết định (`editor-engine.ts`), không phải ở đây.
 */
export type GeometryResult = {
  valid: boolean
  errors: string[]
  /** Cảnh báo ràng buộc thật (vẫn commit). Chỉnh tay hợp lệ không phải cảnh báo: xem `manual` (V2.3 quyết định 3). */
  advisories: string[]
  /** Tư thế khác phương án gốc: nhãn xám "Đã chỉnh thủ công", không tô hổ phách. */
  manual: boolean
  supportRatio: number
  overlapIds: readonly string[]
  /** Vật cản kiện chồng lên hoặc tựa lên (`params.obstacleId` của issue), để mô tả vật cản bên cạnh câu lỗi. */
  obstacleIds: readonly string[]
}
