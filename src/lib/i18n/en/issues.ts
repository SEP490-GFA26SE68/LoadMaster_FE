import type { Dictionary } from '../types'
import type { issues as source } from '../vi/issues'

export const issues = {
  subject: { placement: 'Placement {id}', obstacle: 'Obstacle {id}' },
  DIMENSION_NOT_POSITIVE: {
    vehicle: '{field} must be greater than {zero}.',
    obstacle: '{field} of obstacle {obstacleId} must be greater than {zero}.',
    package: '{field} of package {packageId} must be greater than {zero}.',
  },
  DOOR_EXCEEDS_INNER: {
    y: 'Door width {doorCm} cannot exceed vehicle inner width {innerCm}.',
    z: 'Door height {doorCm} cannot exceed vehicle inner height {innerCm}.',
  },
  NO_ALLOWED_ORIENTATION: 'Package {packageId} has no allowed orientation.',
  PAYLOAD_EXCEEDED: 'Total cargo weight {totalKg} exceeds vehicle payload {maxPayloadKg}.',
  MUST_LOAD_PAYLOAD_EXCEEDED: 'Must-load packages alone weigh {totalKg}, exceeding vehicle payload {maxPayloadKg}.',
  DOOR_TOO_SMALL: 'Package {packageId} cannot pass through the {door} door.',
  EXCEEDS_BOUNDARY: {
    x: {
      beforeOrigin: '{subject} extends {overCm} past the front wall.',
      beyondInterior: '{subject} exceeds vehicle length by {overCm}.',
    },
    y: {
      beforeOrigin: '{subject} extends {overCm} past the left wall.',
      beyondInterior: '{subject} exceeds vehicle width by {overCm}.',
    },
    z: {
      beforeOrigin: '{subject} is {overCm} below the floor.',
      beyondInterior: '{subject} exceeds vehicle height by {overCm}.',
    },
  },
  OVERLAP: '{id} overlaps {related}.',
  OBSTACLE_OVERLAP: '{id} overlaps obstacle {obstacleId}.',
  NON_BEARING_SUPPORT: '{id} rests on obstacle {obstacleId}, which cannot bear load.',
  SUPPORT_BELOW_MIN: '{id} support ratio {ratio} is below the required {required}.',
  TOP_LOAD_EXCEEDED: '{subject} carries {loadKg} on top, above its limit of {maxKg}.',
  NOT_STACKABLE: '{id} is not stackable but supports {related}.',
  STACK_COUNT_EXCEEDED: '{id} is in a stack of {layers} layers, above the limit of {maxStackCount}.',
  LIFO_BLOCKED: '{id} is fully blocked by packages delivered later.',
  LIFO_PARTIAL: '{id} is {coverage} blocked by packages delivered later.',
  COG_LATERAL: 'Cargo center of gravity is {offsetCm} off the centerline, beyond the {limitCm} limit.',
  COG_LONGITUDINAL: {
    front: 'Cargo center of gravity is {offsetCm} towards the front wall from mid-length, beyond the {limitCm} limit.',
    rear: 'Cargo center of gravity is {offsetCm} towards the door from mid-length, beyond the {limitCm} limit.',
  },
  COG_HIGH: 'Cargo center of gravity is {heightCm} above the floor, beyond the {limitCm} limit.',
  AXLE_OVERLOAD: {
    front: 'Front axle load {loadKg} exceeds the {limitKg} limit by {overKg}.',
    rear: 'Rear axle load {loadKg} exceeds the {limitKg} limit by {overKg}.',
  },
  MUST_LOAD_UNPLACED: 'Must-load package {packageId} was not placed.',
  LOADING_ORDER_INFEASIBLE: '{id} is loaded before the packages supporting it: {related}.',
  DUPLICATE_INSTANCE_ID: 'ID {id} is used by {occurrences} package lines: {related}.',
  ORIENTATION_MISMATCH: 'Placed dimensions of {id} do not match orientation {orientation}.',
  ORIENTATION_NOT_ALLOWED: '{id} is placed in orientation {orientation}, which its package does not allow.',
  PINNED_INSTANCE_UNKNOWN: 'Pinned package {id} is no longer on the trip, so it cannot be kept.',
} satisfies Dictionary<typeof source>
