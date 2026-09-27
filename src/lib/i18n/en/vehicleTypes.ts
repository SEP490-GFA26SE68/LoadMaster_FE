import type { Dictionary } from '../types'
import type { vehicleTypes as source } from '../vi/vehicleTypes'

export const vehicleTypes = {
  title: 'Vehicle types',
  count: { one: '{count} vehicle type, set on {assigned} vehicles', other: '{count} vehicle types, set on {assigned} vehicles' },
  empty: 'No vehicle types yet.',
} satisfies Dictionary<typeof source>
