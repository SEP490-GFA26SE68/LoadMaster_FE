import { expectTypeOf, test } from 'vitest'
import type { ConstraintIssue } from '@/domain/constraints'
import type {
  CargoPackage,
  FragilityLevel,
  HandlingClass,
  OptimizationRequest,
  OptimizationResult,
  OrientationCode,
  PackagePlacement,
  UnplacedPackage,
  VehicleAxle,
  VehicleConfig,
  VehicleObstacle,
} from '@/domain/models'

/**
 * Chép nguyên văn khối type của Spec mục 6 — nguồn đối chiếu độc lập với schema zod.
 * Kiểm ở lúc biên dịch: `pnpm build` chạy `tsc -b` trên cả file test, lệch một trường là build đỏ.
 */
declare namespace Spec {
  export type OrientationCode =
    | "LWH" | "LHW" | "WLH"
    | "WHL" | "HLW" | "HWL";

  export type FragilityLevel =
    | "NONE" | "LOW" | "MEDIUM" | "HIGH";

  export interface VehicleConfig {
    id: string;
    name: string;
    innerLengthCm: number;
    innerWidthCm: number;
    innerHeightCm: number;
    maxPayloadKg: number;
    doorWidthCm: number;
    doorHeightCm: number;
    doorPosition: "REAR";
    clearanceCm: number;
    floorMaxLoadKg?: number;
    floorPressureLimitKgPerCm2?: number;
    obstacles: VehicleObstacle[];
    axles?: VehicleAxle[];
  }

  export interface VehicleObstacle {
    id: string;
    type: "WHEEL_ARCH" | "COOLING_UNIT" |
          "PARTITION" | "RESERVED_ZONE";
    xCm: number;
    yCm: number;
    zCm: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    loadBearing: boolean;
    maxTopLoadKg?: number;
  }

  export interface VehicleAxle {
    id: string;
    name: string;
    positionXCm: number;
    emptyLoadKg: number;
    maxLoadKg: number;
  }

  export interface CargoPackage {
    id: string;
    name: string;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
    quantity: number;
    allowedOrientations: OrientationCode[];
    keepUpright: boolean;
    fragilityLevel: FragilityLevel;
    stackable: boolean;
    maxTopLoadKg: number;
    maxStackCount?: number;
    minSupportRatio: number;
    deliveryStop: number;
    priority: number;
    mustLoad: boolean;
    groupId?: string;
    notes?: string;
  }

  export interface PackagePlacement {
    packageInstanceId: string;
    orientation: OrientationCode;
    xCm: number;
    yCm: number;
    zCm: number;
    placedLengthCm: number;
    placedWidthCm: number;
    placedHeightCm: number;
    loadingOrder: number;
    unloadingOrder: number;
    supportRatio: number;
    constraintWarnings: string[];
  }

  export interface UnplacedPackage {
    packageInstanceId: string;
    reasonCode:
      | "NO_SPACE"
      | "OVER_PAYLOAD"
      | "DOOR_TOO_SMALL"
      | "NO_ALLOWED_ORIENTATION"
      | "STACKING_VIOLATION"
      | "LIFO_VIOLATION"
      | "UNKNOWN";
    message: string;
  }

  export interface OptimizationRequest {
    vehicle: VehicleConfig;
    packages: CargoPackage[];
    settings: {
      method: "MOCK" | "EP_DBLF" | "GA" |
              "SA" | "BBMP_DCS_PQNET";
      timeLimitSeconds: number;
      randomSeed?: number;
      enforceLifo: boolean;
      prioritizeLowCenterOfGravity: boolean;
    };
  }

  export interface OptimizationResult {
    jobId: string;
    status: "COMPLETED" | "FAILED";
    method: string;
    isMockResult: boolean;
    placements: PackagePlacement[];
    unplacedPackages: UnplacedPackage[];
    metrics: {
      totalVehicleVolumeCm3: number;
      usedVolumeCm3: number;
      volumeUtilizationPercent: number;
      maxPayloadKg: number;
      usedPayloadKg: number;
      payloadUtilizationPercent: number;
      placedCount: number;
      unplacedCount: number;
      centerOfGravityCm?: {
        x: number;
        y: number;
        z: number;
      };
      runtimeMs: number;
    };
  }
}

/**
 * Trường theo backend v2 nằm ngoài Spec (FE-3b-04, D-69): D-04 "không thêm trường" đã bị thay, mỗi trường thêm khai tường minh ở đây —
 * thêm trường vào model mà không ghi vào đây thì build đỏ.
 */
interface FeCargoPackage extends Spec.CargoPackage {
  handlingClass?: HandlingClass;
}
/** FE-5b-01: giới hạn theo loại xe (D-78, D-79), kho điền khi đọc xe. */
interface FeVehicleConfig extends Spec.VehicleConfig {
  frontAxleLimitKg?: number;
  rearAxleLimitKg?: number;
  maxCogOffsetRatio?: number;
}
interface FeOptimizationRequest extends Omit<Spec.OptimizationRequest, 'packages' | 'vehicle'> {
  vehicle: FeVehicleConfig;
  packages: FeCargoPackage[];
  /** FE-BL-02: kiện đã ghim, giữ đúng vị trí và hướng trong mọi phương án của lần chạy. */
  pinnedPlacements?: FePackagePlacement[];
}
/** FE-5b-04: lý do `CONSTRAINT_VIOLATED` kèm các ràng buộc đã chặn kiện. */
interface FeUnplacedPackage extends Omit<Spec.UnplacedPackage, 'reasonCode'> {
  reasonCode: Spec.UnplacedPackage['reasonCode'] | 'CONSTRAINT_VIOLATED';
  violatedConstraints?: ConstraintIssue[];
}
/** FE-5b-03: tải trục trước / sau của kết quả, chỉ có khi tính được. */
type SpecMetrics = Spec.OptimizationResult['metrics']
interface FeMetrics extends SpecMetrics {
  frontAxleLoadKg?: number;
  rearAxleLoadKg?: number;
  /** FE-5b-02: số kiện nằm ngoài vùng của điểm giao mình. */
  rehandlingCount?: number;
}
/** FE-5b-02: vùng theo điểm giao mà kiện đang nằm. FE-BL-02: kiện đã ghim vị trí. */
interface FePackagePlacement extends Spec.PackagePlacement {
  stopZoneId?: string;
  pinned?: boolean;
}
/** FE-5b-02: một vùng theo điểm giao trên trục X của thùng; `stopId` là số điểm giao (`deliveryStop`). */
interface FeStopZone {
  id: string;
  stopId: number;
  startXCm: number;
  endXCm: number;
}
interface FeOptimizationResult extends Omit<Spec.OptimizationResult, 'placements' | 'unplacedPackages' | 'metrics'> {
  placements: FePackagePlacement[];
  unplacedPackages: FeUnplacedPackage[];
  stopZones?: FeStopZone[];
  metrics: FeMetrics;
}

test('the model types are the Spec §6 contract plus the declared backend fields: same optionality, nothing else extra', () => {
  expectTypeOf<OrientationCode>().toEqualTypeOf<Spec.OrientationCode>()
  expectTypeOf<FragilityLevel>().toEqualTypeOf<Spec.FragilityLevel>()
  expectTypeOf<VehicleConfig>().toEqualTypeOf<FeVehicleConfig>()
  expectTypeOf<VehicleObstacle>().toEqualTypeOf<Spec.VehicleObstacle>()
  expectTypeOf<VehicleAxle>().toEqualTypeOf<Spec.VehicleAxle>()
  expectTypeOf<HandlingClass>().toEqualTypeOf<'STANDARD' | 'FRAGILE' | 'REFRIGERATED' | 'HAZARDOUS' | 'HIGH_VALUE'>()
  expectTypeOf<CargoPackage>().toEqualTypeOf<FeCargoPackage>()
  expectTypeOf<PackagePlacement>().toEqualTypeOf<FePackagePlacement>()
  expectTypeOf<UnplacedPackage>().toEqualTypeOf<FeUnplacedPackage>()
  expectTypeOf<OptimizationRequest>().toEqualTypeOf<FeOptimizationRequest>()
  expectTypeOf<OptimizationResult>().toEqualTypeOf<FeOptimizationResult>()
})
