import type { OrientationCode } from '@/domain/geometry'
import type { BackendPackagePlacement } from '@/features/optimization/optimization-api'
import type { ScenePlacement } from './scene-types'
import type { TripStopApiResponse } from '@/features/trips/trips-api'
import type { CargoPackage } from '@/features/package-pool/packages-api'
import type { VehicleConfig } from '@/domain/models'
import type { BackendLoadPlan } from '@/features/optimization/optimization-api'
import type { BackendTripDetail } from '@/features/trips/trips-api'
import type { TripVehicleConfigResponse } from '@/features/trips/trips-api'
import type { ViewerSceneModel } from './scene-types'


/**
 * Phần hình học của một kiện từ Backend.
 */
export type BackendPlacementGeometry = Pick<
  ScenePlacement,
  'id' | 'packageId' | 'position' |
  'lengthCm' | 'widthCm' | 'heightCm' | 'step'
>

/**
 * Chuyển tọa độ và kích thước Backend sang FE.
 * Đơn vị: cm.
 */
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

export function adaptBackendScene(
  tripId: string,
  tripDetail: BackendTripDetail,
  vehicle: VehicleConfig,
  plan: BackendLoadPlan,
  packages: readonly CargoPackage[],
): ViewerSceneModel {
  const packageById = new Map(
    packages.map((pkg) => [pkg.id, pkg]),
  )

  const placements = plan.placements.map((placement) => {
    const pkg = packageById.get(String(placement.package_id))

    if (!pkg) {
      throw new Error(
        `Missing package ${placement.package_id}`,
      )
    }

    return adaptBackendScenePlacement(
      placement,
      pkg,
      tripDetail.stops,
    )
  })

  const sortedStops = [...tripDetail.stops].sort(
    (a, b) => a.stopSequence - b.stopSequence,
  )

  return {
    tripId,
    vehicle,
    fillRate: (plan.volume_utilization ?? 0) * 100,
    stops: sortedStops.map((stop) => ({
      number: stop.stopSequence,
      name: stop.stopName ?? stop.address ?? String(stop.id),
      packageCount: placements.filter(
        (placement) => placement.stop === stop.stopSequence,
      ).length,
      ...(stop.deadline ? { deadline: stop.deadline } : {}),
    })),
    zones: [],
    placements,
    unplaced: [],
    placementById: new Map(
      placements.map((placement) => [placement.id, placement]),
    ),
    baseDimensionsById: new Map(
      placements.map((placement) => [
        placement.id,
        {
          lengthCm: packageById.get(placement.packageId)!.lengthCm,
          widthCm: packageById.get(placement.packageId)!.widthCm,
          heightCm: packageById.get(placement.packageId)!.heightCm,
        },
      ]),
    ),
    orientationRulesById: new Map(),
    isMockResult: false,
    ordersRecomputed: false,

    // Chỉ xem; không sử dụng constraint editor của FE.
    engineInput: null,
    metrics: null,
    revision: null,
  }
}