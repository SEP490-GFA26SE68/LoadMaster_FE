export { obstacleToBox, placementToBox } from './box-adapters'
export { MODEL_ISSUE_CODES, type ModelIssueCode } from './issue-codes'
export {
  optimizationRequestSchema,
  optimizationResultSchema,
  packagePlacementSchema,
  type OptimizationRequest,
  type OptimizationResult,
  type PackagePlacement,
  type UnplacedPackage,
} from './optimization'
export { cargoPackageSchema, HANDLING_CLASSES, type CargoPackage, type FragilityLevel, type HandlingClass, type OrientationCode } from './package'
export {
  DEFAULT_MAX_COG_OFFSET_RATIO,
  MAX_COG_OFFSET_RATIO_CEILING,
  vehicleConfigSchema,
  type VehicleAxle,
  type VehicleConfig,
  type VehicleObstacle,
} from './vehicle'
