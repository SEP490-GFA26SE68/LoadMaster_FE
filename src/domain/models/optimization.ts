import { z } from 'zod'
import type { ConstraintIssue } from '@/domain/constraints'
import { finiteNumber, flag, listOf, objectOf, oneOf, positive, ratio, text } from './fields'
import { cargoPackageSchema, orientationCodeSchema } from './package'
import { vehicleConfigSchema } from './vehicle'

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
})

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
})

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
 * `rearAxleLoadKg` (FE-5b-03, ngoài type Spec) chỉ có khi tính được tải trục.
 */
export const optimizationResultSchema = objectOf({
  jobId: text(),
  status: oneOf(['COMPLETED', 'FAILED']),
  method: text(),
  isMockResult: flag(),
  placements: listOf(packagePlacementSchema),
  unplacedPackages: listOf(unplacedPackageSchema),
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
    runtimeMs: finiteNumber(),
  }),
})

export type OptimizationRequest = z.infer<typeof optimizationRequestSchema>
export type OptimizationResult = z.infer<typeof optimizationResultSchema>
export type PackagePlacement = z.infer<typeof packagePlacementSchema>
export type UnplacedPackage = z.infer<typeof unplacedPackageSchema>
