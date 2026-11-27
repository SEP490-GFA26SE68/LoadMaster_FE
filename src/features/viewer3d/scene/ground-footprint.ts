import type { VehicleConfig } from '@/domain/models'
import { truckLayout } from './truck-layout'
import type { GroundFootprint } from './ground-plane'

/** `truckLayout().footprint` tính cả gương hai bên; bóng tiếp xúc chỉ ôm thân xe nên thu vào chừng này mỗi phía (m). */
const MIRROR_ALLOWANCE = 0.25

/**
 * Cao độ mặt đất và phạm vi xe (hệ góc thùng, m) cho `GroundPlane`. **Chỗ nối duy nhất** với hình xe: mọi số lấy từ `truckLayout` —
 * `groundY` theo chiều cao sàn của hạng xe, `footprint` từ mũi cản trước tới qua cản sau — nên mặt đất và bóng tiếp xúc đi theo
 * đúng chiếc xe đang vẽ (van thấp, tải nặng cao).
 */
export function groundFootprintOf(vehicle: VehicleConfig): GroundFootprint {
  const { groundY, footprint } = truckLayout(vehicle)
  const [z0, z1] = footprint.z
  return {
    groundY,
    x0: footprint.x[0],
    x1: footprint.x[1],
    halfWidth: (z1 - z0) / 2 - MIRROR_ALLOWANCE,
    centerZ: (z0 + z1) / 2,
  }
}
