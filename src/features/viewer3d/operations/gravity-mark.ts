import type { VehicleConfig } from '@/domain/models'
import type { PositionCm } from '@/features/viewer3d/scene-input'
import { toScene } from '../scene/units'

/** Sáu đoạn thẳng × hai đầu × ba toạ độ: kích thước cố định của bộ đệm dấu G. */
export const GRAVITY_MARK_FLOATS = 36
/** Cao hơn sàn thùng một chút để đường trên sàn không nhấp nháy với mặt sàn (đơn vị cảnh). */
const FLOOR_Y = 0.01
/** Nửa cạnh chữ thập trên sàn (đơn vị cảnh, 10 cm). */
const CROSS = 0.1

/**
 * Ghi dấu trọng tâm hàng G (Spec vật lý 10.3) vào `out`, đơn vị cảnh: đường chiếu đứng từ sàn lên G, chữ thập ở chân đường chiếu,
 * đường từ chân tới giữa sàn thùng và chữ thập ở giữa sàn — độ lệch so với giữa thùng đọc được ngay trên sàn. Ghi đè cùng một mảng
 * mỗi lần nên khung 3D chỉ đánh dấu bộ đệm cần tải lại, không cấp bộ nhớ mới.
 */
export function writeGravityMark(out: Float32Array, center: PositionCm,
  vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm'>): Float32Array {
  const gx = toScene(center.x), gy = toScene(center.z), gz = toScene(center.y)
  const cx = toScene(vehicle.innerLengthCm / 2), cz = toScene(vehicle.innerWidthCm / 2)
  out.set([
    gx, FLOOR_Y, gz, gx, gy, gz,
    gx - CROSS, FLOOR_Y, gz, gx + CROSS, FLOOR_Y, gz,
    gx, FLOOR_Y, gz - CROSS, gx, FLOOR_Y, gz + CROSS,
    gx, FLOOR_Y, gz, cx, FLOOR_Y, cz,
    cx - CROSS, FLOOR_Y, cz, cx + CROSS, FLOOR_Y, cz,
    cx, FLOOR_Y, cz - CROSS, cx, FLOOR_Y, cz + CROSS,
  ])
  return out
}
