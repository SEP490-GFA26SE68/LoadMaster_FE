import { z } from 'zod'
import type { ConstraintIssue } from '@/domain/constraints'
import { finiteNumber, flag, listOf, objectOf, oneOf, positive, ratio, text } from './fields'
import { cargoPackageSchema, orientationCodeSchema } from './package'
import { vehicleConfigSchema } from './vehicle'

/**
 * `stopZoneId` (FE-5b-02, ngoài type Spec): mã vùng theo điểm giao mà kiện đang nằm (`stopZones[].id` của kết quả); vắng khi kết quả
 * không chia vùng. `pinned` (FE-BL-02, ngoài type Spec): kiện đã ghim vị trí, có mặt chỉ khi `true` — ghim lưu cùng phương án nên sống
 * qua Duyệt và mở lại.
 */
export const packagePlacementSchema = objectOf({
  packageInstanceId: text(),
  orientation: orientationCodeSchema,
  xCm: finiteNumber(),
  yCm: finiteNumber(),
  zCm: finiteNumber(),
  placedLengthCm: positive('placement.dimension.positive'),
  placedWidthCm: positive('placement.dimension.positive'),
  placedHeightCm: positive('placement.dimension.positive'),
  loadingOrder: finiteNumber(),
  unloadingOrder: finiteNumber(),
  supportRatio: ratio('placement.supportRatio.range'),
  constraintWarnings: listOf(text()),
  stopZoneId: text().optional(),
  pinned: flag().optional(),
})

/**
 * `pinnedPlacements` (FE-BL-02, ngoài type Spec): kiện đã ghim — giữ đúng vị trí và hướng trong mọi phương án của lần chạy, mock xếp phần
 * còn lại quanh chúng. Vắng khi lần chạy không giữ kiện nào (không phải mảng rỗng, để request cũ giữ nguyên mã job).
 */
export const optimizationRequestSchema = objectOf({
  vehicle: vehicleConfigSchema,
  packages: listOf(cargoPackageSchema),
  settings: objectOf({
    method: oneOf(['MOCK', 'EP_DBLF', 'GA', 'SA', 'BBMP_DCS_PQNET']),
    timeLimitSeconds: finiteNumber(),
    randomSeed: finiteNumber().optional(),
    enforceLifo: flag(),
    prioritizeLowCenterOfGravity: flag(),
  }),
  pinnedPlacements: listOf(packagePlacementSchema).optional(),
})

/**
 * Vùng theo điểm giao trên trục X của thùng (FE-5b-02, D-79; hàm thuần ở `@/domain/zones`). `stopId` là số điểm giao
 * (`CargoPackage.deliveryStop`) — request của Spec không mang mã điểm nào khác.
 */
const stopZoneSchema = objectOf({ id: text(), stopId: finiteNumber(), startXCm: finiteNumber(), endXCm: finiteNumber() })

/**
 * Ràng buộc đã chặn một kiện chưa xếp (`CONSTRAINT_VIOLATED`, FE-5b-04): issue của `@/domain/constraints` (mã + tham số) để UI dịch
 * bằng `formatIssue`. Schema chỉ kiểm hình dạng (mảng các đối tượng có `code` và `params`); mã và tham số là của nơi tạo kết quả.
 */
const violatedConstraintsSchema = z.custom<ConstraintIssue[]>(
  (value) =>
    Array.isArray(value) &&
    value.every((item: unknown) => typeof item === 'object' && item !== null && 'code' in item && typeof item.code === 'string' && 'params' in item),
  { error: 'common.array.invalid' },
)

const unplacedPackageSchema = objectOf({
  packageInstanceId: text(),
  reasonCode: oneOf([
    'NO_SPACE',
    'OVER_PAYLOAD',
    'DOOR_TOO_SMALL',
    'NO_ALLOWED_ORIENTATION',
    'STACKING_VIOLATION',
    'LIFO_VIOLATION',
    'CONSTRAINT_VIOLATED',
    'UNKNOWN',
  ]),
  message: text(),
  violatedConstraints: violatedConstraintsSchema.optional(),
})

/**
 * Metric là giá trị dẫn xuất: schema chỉ đòi số hữu hạn; tính đúng thuộc LM-021, kiểm tra thuộc LM-024. `frontAxleLoadKg` /
 * `rearAxleLoadKg` (FE-5b-03, ngoài type Spec) chỉ có khi tính được tải trục. `stopZones` và `rehandlingCount` (FE-5b-02, ngoài
 * type Spec): các vùng theo điểm giao của lần tối ưu và số kiện nằm ngoài vùng của điểm mình; vắng khi kết quả không chia vùng.
 */
export const optimizationResultSchema = objectOf({
  jobId: text(),
  status: oneOf(['COMPLETED', 'FAILED']),
  method: text(),
  isMockResult: flag(),
  placements: listOf(packagePlacementSchema),
  unplacedPackages: listOf(unplacedPackageSchema),
  stopZones: listOf(stopZoneSchema).optional(),
  metrics: objectOf({
    totalVehicleVolumeCm3: finiteNumber(),
    usedVolumeCm3: finiteNumber(),
    volumeUtilizationPercent: finiteNumber(),
    maxPayloadKg: finiteNumber(),
    usedPayloadKg: finiteNumber(),
    payloadUtilizationPercent: finiteNumber(),
    placedCount: finiteNumber(),
    unplacedCount: finiteNumber(),
    centerOfGravityCm: objectOf({ x: finiteNumber(), y: finiteNumber(), z: finiteNumber() }).optional(),
    frontAxleLoadKg: finiteNumber().optional(),
    rearAxleLoadKg: finiteNumber().optional(),
    rehandlingCount: finiteNumber().optional(),
    runtimeMs: finiteNumber(),
  }),
})

export type OptimizationRequest = z.infer<typeof optimizationRequestSchema>
export type OptimizationResult = z.infer<typeof optimizationResultSchema>
export type PackagePlacement = z.infer<typeof packagePlacementSchema>
export type UnplacedPackage = z.infer<typeof unplacedPackageSchema>
