
import type { Dictionary } from '../types'
import type { backendTripRoute as source } from '../vi/backendTripRoute'

export const backendTripRoute = {
  missingDepotCoordinates: 'The departure depot has no coordinates.',
  missingStopCoordinates: '{count} delivery stops have no coordinates and cannot be displayed on the map.',
  routePlanFailed: 'Could not read the saved route from the server — the map joins the stops with straight lines.',
} satisfies Dictionary<typeof source>
