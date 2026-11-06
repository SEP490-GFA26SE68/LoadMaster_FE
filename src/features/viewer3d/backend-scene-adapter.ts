import type { VehicleConfig } from '@/domain/models'
import type { TripVehicleConfigResponse } from '@/features/trips/trips-api'

/** Cấu hình xe của chuyến ở máy chủ (cm, kg) → `VehicleConfig` cho khung 3D của trang xe. */
export function adaptBackendVehicle(
  config: TripVehicleConfigResponse,
): VehicleConfig {
  if (config.doorWidth == null || config.doorHeight == null) {
    throw new Error('Vehicle door dimensions are missing')
  }

  if (config.obstacles.some((obstacle) => obstacle.type === 'OTHER')) {
    throw new Error('Unsupported vehicle obstacle type: OTHER')
  }

  return {
    id: String(config.vehicleId),
    name: config.vehicleName,

    innerLengthCm: config.innerLength,
    innerWidthCm: config.innerWidth,
    innerHeightCm: config.innerHeight,

    maxPayloadKg: config.maxPayloadKg,
    doorWidthCm: config.doorWidth,
    doorHeightCm: config.doorHeight,
    doorPosition: 'REAR',
    clearanceCm: 0,

    ...(config.frontAxleLimitKg != null
      ? { frontAxleLimitKg: config.frontAxleLimitKg }
      : {}),
    ...(config.rearAxleLimitKg != null
      ? { rearAxleLimitKg: config.rearAxleLimitKg }
      : {}),
    maxCogOffsetRatio: config.maxCogOffsetRatio,

    obstacles: config.obstacles.map((obstacle) => {
      if (obstacle.type === 'OTHER') {
        throw new Error('Unsupported obstacle type: OTHER')
      }

      return {
        id: String(obstacle.id),
        type: obstacle.type,
        xCm: obstacle.x,
        yCm: obstacle.y,
        zCm: obstacle.z,
        lengthCm: obstacle.length,
        widthCm: obstacle.width,
        heightCm: obstacle.height,
        loadBearing: obstacle.loadBearing,
      }
    }),
  }
}
