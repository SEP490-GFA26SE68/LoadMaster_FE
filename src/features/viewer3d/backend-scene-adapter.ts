import type { OrientationCode } from '@/domain/geometry'
import type { CargoPackage } from '@/features/package-pool/backend/packages-api'
import type { BackendPackagePlacement } from '@/features/optimization/backend-optimization-api'
import type { TripStopApiResponse } from '@/features/trips/trips-api'
import type { ScenePlacement } from './scene-types'
import type { VehicleConfig } from '@/domain/models'
import type { TripVehicleConfigResponse } from '@/features/trips/trips-api'

/** Cấu hình xe của chuyến ở máy chủ (cm, kg) → `VehicleConfig` cho khung 3D của trang xe. */
export function adaptBackendVehicle(
  config: TripVehicleConfigResponse,
): VehicleConfig {
  if (config.doorWidth == null || config.doorHeight == null) {
    throw new Error('Vehicle door dimensions are missing')
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

type BackendPlacementGeometry = Pick<ScenePlacement, 'id' | 'packageId' | 'position' | 'lengthCm' | 'widthCm' | 'heightCm' | 'step'>

export function adaptBackendPlacementGeometry(
  placement: BackendPackagePlacement,
): BackendPlacementGeometry {
  return {
    id: String(placement.id),
    packageId: String(placement.package_id),
    position: {
      x: placement.pos_x,
      y: placement.pos_y,
      z: placement.pos_z,
    },
    lengthCm: placement.dim_x,
    widthCm: placement.dim_y,
    heightCm: placement.dim_z,
    step: placement.step_sequence,
  }
}

/**
 * Ánh xạ 6 hướng xoay từ OptimizeService sang FE.
 *
 * 0 = LWH
 * 1 = WLH
 * 2 = LHW
 * 3 = WHL
 * 4 = HLW
 * 5 = HWL
 *
 * Giữ nguyên mã 0 và 1 để tương thích dữ liệu cũ.
 */
export function mapBackendRotation(
  rotationType: number,
): OrientationCode {
  switch (rotationType) {
    case 0:
      return 'LWH'
    case 1:
      return 'WLH'
    case 2:
      return 'LHW'
    case 3:
      return 'WHL'
    case 4:
      return 'HLW'
    case 5:
      return 'HWL'
    default:
      throw new Error(
        `Unsupported backend rotation_type: ${rotationType}`,
      )
  }
}

/**
 * Xác định thứ tự điểm giao của một kiện.
 * stopZoneId là database ID, không phải stopSequence.
 */
export function mapBackendPlacementStop(
  placement: BackendPackagePlacement,
  stops: readonly TripStopApiResponse[],
): number {
  const stop = stops.find(
    (item) => item.id === placement.stopZoneId,
  )

  if (!stop) {
    throw new Error(
      `Cannot resolve delivery stop for package ${placement.package_id}`,
    )
  }

  return stop.stopSequence
}

/**
 * Ghép dữ liệu kiện thật với placement đã lưu.
 *
 * Chưa tạo ScenePlacement đầy đủ vì Backend chưa xác nhận
 * quy ước fragilityLevel và unloadingOrder.
 */
export function adaptBackendPlacementData(
  placement: BackendPackagePlacement,
  cargoPackage: CargoPackage,
  stops: readonly TripStopApiResponse[],
) {
  if (cargoPackage.id !== String(placement.package_id)) {
    throw new Error(
      `Package mismatch: ${placement.package_id}`,
    )
  }

  return {
    ...adaptBackendPlacementGeometry(placement),
    name:
      cargoPackage.packageName ??
      cargoPackage.packageCode ??
      cargoPackage.id,
    weightKg: cargoPackage.weightKg,
    stop: mapBackendPlacementStop(placement, stops),
    orientation: mapBackendRotation(placement.rotation_type),
    pinned: cargoPackage.isPinned,
    stackable: cargoPackage.stackable,
    fragilityLevel: cargoPackage.fragilityLevel,
  }
}

/**
 * Tạo ScenePlacement để hiển thị LoadPlan Backend.
 *
 * Những trường chưa có dữ liệu xác thực được đặt ở chế độ
 * trung tính, chỉ sử dụng cho hiển thị, không dùng để
 * đánh giá ràng buộc hoặc duyệt phương án.
 */
export function adaptBackendScenePlacement(
  placement: BackendPackagePlacement,
  cargoPackage: CargoPackage,
  stops: readonly TripStopApiResponse[],
): ScenePlacement {
  if (cargoPackage.id !== String(placement.package_id)) {
    throw new Error(
      `Package mismatch: ${placement.package_id}`,
    )
  }

  const geometry = adaptBackendPlacementGeometry(placement)

  return {
    ...geometry,
    name:
      cargoPackage.packageName ||
      cargoPackage.packageCode ||
      cargoPackage.id,
    stop: mapBackendPlacementStop(placement, stops),
    weightKg: cargoPackage.weightKg,
    orientation: mapBackendRotation(placement.rotation_type),

    // Backend chưa có quy ước đầy đủ cho các trường sau.
    // Chỉ dùng cho render read-only, không dùng để kiểm định.
    unloadingOrder: 0,
    packaging: 'carton',
    fragilityLevel: 'NONE',
    fragile: false,
    stackable: cargoPackage.stackable === true,
    pinned: cargoPackage.isPinned,
    supportRatio: 1,
    constraintWarnings: [],
    outOfZone: false,
  }
}
