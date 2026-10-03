import type { Dictionary } from '../types'
import type { monitoring as source } from '../vi/monitoring'

export const monitoring = {
  location: {
    title: 'Vehicle position',
    sources: { SIMULATED: 'Simulated', GPS: 'GPS' },
    vehicle: '{name} ({source})',
    moving: 'At {time} · moving at {speed} km/h',
    standing: 'At {time} · standing',
    basis: 'Arrival times of the stops not yet delivered are recalculated from the vehicle position after each position point, along straight lines between the points.',
  },
} satisfies Dictionary<typeof source>
