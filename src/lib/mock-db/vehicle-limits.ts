import { gt } from '@/domain/geometry'
import { DEFAULT_MAX_COG_OFFSET_RATIO, type VehicleConfig } from '@/domain/models'
import type { VehicleType } from './source-types'

/** Ba giới hạn xếp hàng của xe theo backend (FE-5b-01): tải trục trước / sau (D-78) và độ lệch trọng tâm tối đa (D-79). */
export type VehicleLimits = Pick<VehicleConfig, 'frontAxleLimitKg' | 'rearAxleLimitKg' | 'maxCogOffsetRatio'>

/** Giới hạn mà loại xe trao cho xe gắn nó; trường loại xe không khai thì vắng. `type` vắng (xe chưa gắn loại) là không có giới hạn nào. */
export function limitsOfType(type: Pick<VehicleType, keyof VehicleLimits> | undefined): VehicleLimits {
  if (type === undefined) return {}
  return {
    ...(type.frontAxleLimitKg === undefined ? {} : { frontAxleLimitKg: type.frontAxleLimitKg }),
    ...(type.rearAxleLimitKg === undefined ? {} : { rearAxleLimitKg: type.rearAxleLimitKg }),
    maxCogOffsetRatio: type.maxCogOffsetRatio,
  }
}

/** Xe như kho lưu: không mang giới hạn — giới hạn thuộc loại xe, không ghi vào từng xe. */
export function withoutLimits(vehicle: VehicleConfig): VehicleConfig {
  const { frontAxleLimitKg: _front, rearAxleLimitKg: _rear, maxCogOffsetRatio: _ratio, ...own } = vehicle
  return own
}

/**
 * Xe như kho trả ra: giới hạn lấy từ loại xe đang gắn. Xe chưa gắn loại không có trường giới hạn nào — tải trục so với
 * `axles[].maxLoadKg`, trọng tâm dùng mặc định của domain (`axleLoadsOf`, `checkCenterOfGravity`).
 */
export function withTypeLimits(vehicle: VehicleConfig, type: Pick<VehicleType, keyof VehicleLimits> | undefined): VehicleConfig {
  return { ...withoutLimits(vehicle), ...limitsOfType(type) }
}

/** Hai xe có cùng giới hạn hiệu lực không — `maxCogOffsetRatio` vắng tính là mặc định, nên gắn loại 0,15 cho xe chưa gắn không đổi gì. */
export function sameLimits(a: VehicleLimits, b: VehicleLimits): boolean {
  return (
    a.frontAxleLimitKg === b.frontAxleLimitKg &&
    a.rearAxleLimitKg === b.rearAxleLimitKg &&
    (a.maxCogOffsetRatio ?? DEFAULT_MAX_COG_OFFSET_RATIO) === (b.maxCogOffsetRatio ?? DEFAULT_MAX_COG_OFFSET_RATIO)
  )
}

/**
 * Giới hạn trục của một loại xe lấy từ trục của xe mẫu thuộc loại đó (seed, FE-5b-01 — không đặt số mới): trục đầu (X nhỏ nhất) là
 * nhóm trước, tổng các trục còn lại là nhóm sau. Xe mẫu không khai trục, hoặc khai tải tối đa 0 kg, thì loại xe không có giới hạn đó.
 */
export function axleLimitsFromAxles(vehicle: Pick<VehicleConfig, 'axles'>): Pick<VehicleType, 'frontAxleLimitKg' | 'rearAxleLimitKg'> {
  const [front, ...rear] = (vehicle.axles ?? []).toSorted((a, b) => a.positionXCm - b.positionXCm)
  const rearKg = rear.reduce((sum, axle) => sum + axle.maxLoadKg, 0)
  return {
    ...(front !== undefined && gt(front.maxLoadKg, 0) ? { frontAxleLimitKg: front.maxLoadKg } : {}),
    ...(gt(rearKg, 0) ? { rearAxleLimitKg: rearKg } : {}),
  }
}
