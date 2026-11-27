import type { VehicleConfig } from '@/domain/models'
import { CAB_X, truckLayout, WHEEL_RADIUS, WHEEL_Y } from './truck-layout'
import { containerSize } from './units'
import type { GroundFootprint } from './ground-plane'

/**
 * Cao độ mặt đất và phạm vi xe (hệ góc thùng, m) cho `GroundPlane`. **Chỗ nối duy nhất** với hình xe: khi `truckLayout` tự trả cao độ
 * mặt đất và phạm vi xe theo hạng, chỉ sửa thân hàm này. Hôm nay: đáy lốp (`WHEEL_Y − WHEEL_RADIUS`), từ mũi cabin (`CAB_X − 0,85`, hoặc
 * đầu khung sườn nếu xa hơn) tới cuối khung sườn sau cửa, rộng bằng thùng cộng 5 cm mỗi bên.
 */
export function groundFootprintOf(vehicle: VehicleConfig): GroundFootprint {
  const { length, width } = containerSize(vehicle)
  const { frame } = truckLayout(length, width, vehicle.axles)
  return {
    groundY: WHEEL_Y - WHEEL_RADIUS,
    x0: Math.min(CAB_X - 0.85, frame.fromX),
    x1: Math.max(length, frame.toX),
    halfWidth: width / 2 + 0.05,
    centerZ: width / 2,
  }
}
