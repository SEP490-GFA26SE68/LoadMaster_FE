
import type { Dictionary } from '../types'
import type { packageStatus as source } from '../vi/packageStatus'

export const packageStatus = {
  PENDING: 'Pending',
  PLANNED: 'Planned',
  LOADED: 'Loaded',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
} satisfies Dictionary<typeof source>
