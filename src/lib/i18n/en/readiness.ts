import type { Dictionary } from '../types'
import type { readiness as source } from '../vi/readiness'

export const readiness = {
  title: 'Ready to optimize',
  ready: 'Ready to optimize',
  notReady: 'Not ready to optimize',
  checks: {
    VEHICLE_ASSIGNED: { label: 'Vehicle', pass: 'Vehicle chosen', fail: 'No vehicle chosen, or the vehicle is in maintenance' },
    PACKAGES_PRESENT: { label: 'Packages', pass: '{count} packages', fail: 'No packages yet' },
    PACKAGES_VALID: { label: 'Package data', pass: 'Every package is valid', fail: '{invalid} package lines are not valid' },
    STOPS_VALID: {
      label: 'Stops',
      pass: '{stops} stops, every package on an existing stop',
      warn: '{empty} stops have no packages',
      fail: 'No stops yet, or {outside} package lines point to a stop that does not exist',
    },
    WEIGHT_WITHIN_PAYLOAD: { label: 'Weight', pass: '{total} / {payload}', fail: '{total} exceeds the payload of {payload}' },
    VOLUME_WITHIN_CARGO: { label: 'Volume', pass: '{total} / {cargo}', fail: '{total} exceeds the cargo volume of {cargo}' },
  },
} satisfies Dictionary<typeof source>
