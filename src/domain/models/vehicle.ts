import type { z } from 'zod'
import { gt, vehicleBoundaryExcess, type Box, type VehicleInterior } from '@/domain/geometry'
import { obstacleToBox } from './box-adapters'
import { finiteNumber, flag, listOf, nonNegative, objectOf, oneOf, positive, text } from './fields'
import { report, rule } from './issue-codes'

const vehicleObstacleSchema = objectOf({
  id: text(),
  type: oneOf(['WHEEL_ARCH', 'COOLING_UNIT', 'PARTITION', 'RESERVED_ZONE']),
  xCm: finiteNumber(),
  yCm: finiteNumber(),
  zCm: finiteNumber(),
  lengthCm: positive('obstacle.dimension.positive'),
  widthCm: positive('obstacle.dimension.positive'),
  heightCm: positive('obstacle.dimension.positive'),
  loadBearing: flag(),
  maxTopLoadKg: nonNegative('obstacle.maxTopLoadKg.nonNegative').optional(),
}).superRefine((obstacle, ctx) => {
  // Quyết định LM-010: tải trên chỉ có nghĩa với vật cản chịu tải (Spec 7.6). Vật cản không chịu tải khai > 0 kg là dữ liệu
  // mâu thuẫn nên bị từ chối như stackable = false; 0 kg hoặc bỏ trống thì hợp lệ.
  if (!obstacle.loadBearing && obstacle.maxTopLoadKg !== undefined && gt(obstacle.maxTopLoadKg, 0)) {
    report(ctx, 'obstacle.maxTopLoadKg.notLoadBearing', ['maxTopLoadKg'])
  }
})

const vehicleAxleSchema = objectOf({
  id: text(),
  name: text(),
  positionXCm: finiteNumber(),
  emptyLoadKg: nonNegative('axle.emptyLoadKg.nonNegative'),
  maxLoadKg: nonNegative('axle.maxLoadKg.nonNegative'),
})

const dimensionCm = positive('vehicle.dimension.positive')

/**
 * Độ lệch trọng tâm hàng tối đa so với giữa thùng, tính bằng tỷ lệ chiều dài (dọc) và chiều rộng (ngang) lòng thùng (D-79). Xe không
 * khai — không gắn loại xe — dùng mặc định này. Trọng tâm không thể lệch quá nửa thùng nên tỷ lệ nằm trong (0, 0,5].
 */
export const DEFAULT_MAX_COG_OFFSET_RATIO = 0.15
export const MAX_COG_OFFSET_RATIO_CEILING = 0.5

const cogOffsetRatio = finiteNumber().refine(
  (value) => gt(value, 0) && !gt(value, MAX_COG_OFFSET_RATIO_CEILING),
  rule('vehicle.maxCogOffsetRatio.range'),
)

export const vehicleConfigSchema = objectOf({
  id: text(),
  name: text(),
  innerLengthCm: dimensionCm,
  innerWidthCm: dimensionCm,
  innerHeightCm: dimensionCm,
  maxPayloadKg: positive('vehicle.maxPayloadKg.positive'),
  doorWidthCm: dimensionCm,
  doorHeightCm: dimensionCm,
  doorPosition: oneOf(['REAR']),
  clearanceCm: nonNegative('vehicle.clearanceCm.nonNegative'),
  floorMaxLoadKg: nonNegative('vehicle.floorMaxLoadKg.nonNegative').optional(),
  floorPressureLimitKgPerCm2: nonNegative('vehicle.floorPressureLimitKgPerCm2.nonNegative').optional(),
  obstacles: listOf(vehicleObstacleSchema),
  axles: listOf(vehicleAxleSchema).optional(),
  // Giới hạn theo loại xe của backend v2 (FE-5b-01, D-78, D-79) — ngoài type Spec. Kho điền từ loại xe đang gắn khi đọc xe; xe không
  // gắn loại thì vắng: tải trục so với `axles[].maxLoadKg`, trọng tâm dùng `DEFAULT_MAX_COG_OFFSET_RATIO`.
  frontAxleLimitKg: positive('vehicle.axleLimitKg.positive').optional(),
  rearAxleLimitKg: positive('vehicle.axleLimitKg.positive').optional(),
  maxCogOffsetRatio: cogOffsetRatio.optional(),
}).superRefine((vehicle, ctx) => {
  // Spec 9.2: cửa sau không lớn hơn mặt cắt trong thùng
  if (gt(vehicle.doorWidthCm, vehicle.innerWidthCm)) report(ctx, 'vehicle.door.exceedsInner', ['doorWidthCm'])
  if (gt(vehicle.doorHeightCm, vehicle.innerHeightCm)) report(ctx, 'vehicle.door.exceedsInner', ['doorHeightCm'])
  // Spec 9.2: vật cản nằm trong thùng; biên lấy từ geometry, không tự tính lại
  vehicle.obstacles.forEach((obstacle, index) => {
    if (sticksOut(obstacleToBox(obstacle), vehicle)) report(ctx, 'vehicle.obstacle.outsideInterior', ['obstacles', index])
  })
})

function sticksOut(box: Box, interior: VehicleInterior): boolean {
  const { beforeOrigin, beyondInterior } = vehicleBoundaryExcess(box, interior)
  return [beforeOrigin, beyondInterior].some(({ xCm, yCm, zCm }) => gt(xCm, 0) || gt(yCm, 0) || gt(zCm, 0))
}

export type VehicleObstacle = z.infer<typeof vehicleObstacleSchema>
export type VehicleAxle = z.infer<typeof vehicleAxleSchema>
export type VehicleConfig = z.infer<typeof vehicleConfigSchema>
