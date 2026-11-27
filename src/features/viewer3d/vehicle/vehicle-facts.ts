import { axleLoadsOf, type AxleLoadUnavailableReason } from '@/domain/metrics'
import type { VehicleConfig, VehicleObstacle } from '@/domain/models'

type ObstacleType = VehicleObstacle['type']

/** Thứ tự loại vật cản trên bảng thông số xe: theo thứ tự khai của contract. */
const OBSTACLE_ORDER: readonly ObstacleType[] = ['WHEEL_ARCH', 'COOLING_UNIT', 'PARTITION', 'RESERVED_ZONE', 'OTHER']

export type VehicleAxleFacts =
  | { status: 'missing' }
  | { status: 'unavailable'; count: number; reason: Exclude<AxleLoadUnavailableReason, 'NO_AXLES'> }
  /** Giới hạn vắng khi loại xe lẫn các trục của nhóm đều chưa khai (tải tối đa 0 kg là chưa khai). */
  | { status: 'computed'; count: number; frontLimitKg?: number; rearLimitKg?: number }

/** Số của bảng thông số xe trong Planner — chỉ những gì `VehicleConfig` khai, không suy thêm. */
export type VehicleFacts = {
  readonly name: string
  readonly interior: { lengthCm: number; widthCm: number; heightCm: number; volumeCm3: number }
  readonly door: { widthCm: number; heightCm: number }
  /** Khoảng hở quanh kiện khi qua cửa; `null` khi xe khai 0. */
  readonly clearanceCm: number | null
  readonly payloadKg: number
  readonly axles: VehicleAxleFacts
  /** Số vật cản theo loại, bỏ loại không có. */
  readonly obstacles: readonly { type: ObstacleType; count: number }[]
}

/**
 * Dựng số cho thẻ xe và bảng thông số xe của Planner. Giới hạn nhóm trục lấy từ chính mô hình tải trục (`axleLoadsOf`, không hàng):
 * `frontAxleLimitKg` / `rearAxleLimitKg` của xe, vắng thì tổng tải tối đa các trục của nhóm.
 */
export function vehicleFacts(vehicle: VehicleConfig): VehicleFacts {
  const count = vehicle.axles?.length ?? 0
  const loads = axleLoadsOf(vehicle, { totalKg: 0 })
  const axles: VehicleAxleFacts = loads.status === 'computed'
    ? {
        status: 'computed', count,
        ...(loads.front.limitKg === undefined ? {} : { frontLimitKg: loads.front.limitKg }),
        ...(loads.rear.limitKg === undefined ? {} : { rearLimitKg: loads.rear.limitKg }),
      }
    : loads.reason === 'NO_AXLES' ? { status: 'missing' } : { status: 'unavailable', count, reason: loads.reason }
  const byType = new Map<ObstacleType, number>()
  for (const obstacle of vehicle.obstacles) byType.set(obstacle.type, (byType.get(obstacle.type) ?? 0) + 1)
  return {
    name: vehicle.name,
    interior: {
      lengthCm: vehicle.innerLengthCm, widthCm: vehicle.innerWidthCm, heightCm: vehicle.innerHeightCm,
      volumeCm3: vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm,
    },
    door: { widthCm: vehicle.doorWidthCm, heightCm: vehicle.doorHeightCm },
    clearanceCm: vehicle.clearanceCm > 0 ? vehicle.clearanceCm : null,
    payloadKg: vehicle.maxPayloadKg,
    axles,
    obstacles: OBSTACLE_ORDER.flatMap((type) => {
      const n = byType.get(type) ?? 0
      return n > 0 ? [{ type, count: n }] : []
    }),
  }
}
