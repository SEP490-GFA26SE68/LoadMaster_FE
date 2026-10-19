
import type { Dictionary } from '../types'
import type { backendTripRoute as source } from '../vi/backendTripRoute'

export const backendTripRoute = {
  missingDepotCoordinates: 'The departure depot has no coordinates.',
  missingStopCoordinates: '{count} delivery stops have no coordinates and cannot be displayed on the map.',
} satisfies Dictionary<typeof source>
