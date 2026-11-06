export { vehicleBoundaryExcess, type AxisAmountCm, type BoundaryExcess, type VehicleInterior } from './boundary'
export { overlaps, volumeCm3, type Box } from './box'
export { overlapArea2D, overlapVolume } from './intersection'
export { EPSILON, eq, gt, lt, roundCm, roundKg } from './numeric'
export {
  effectiveOrientations,
  isUpright,
  matchesOrientation,
  nextOrientation,
  orientDimensions,
  previousOrientation,
  ORIENTATION_CODES,
  UPRIGHT_ORIENTATIONS,
  type OrientationCode,
  type OrientationRules,
  type OrientedPlacement,
  type PackageDimensions,
  type PlacedDimensions,
} from './orientation'
export { coveredArea, type Rect } from './rect'
export {
  CONTACT_TOLERANCE_CM,
  createSpatialGrid,
  DEFAULT_GRID_CELL_CM,
  type SpatialEntry,
  type SpatialGrid,
  type SpatialQueryOptions,
} from './spatial-grid'
