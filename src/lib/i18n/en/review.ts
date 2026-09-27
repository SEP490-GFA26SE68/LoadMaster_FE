import type { Dictionary } from '../types'
import type { review as source } from '../vi/review'

export const review = {
  title: 'Awaiting approval',
  count: { one: '{count} plan awaiting approval', other: '{count} plans awaiting approval' },
  empty: 'No plans are awaiting approval.',
  decisions: {
    rejected: 'Rejected',
    reoptimize_requested: 'Re-optimization requested',
    change_vehicle_suggested: 'Vehicle change suggested',
    split_trip_suggested: 'Trip split suggested',
  },
} satisfies Dictionary<typeof source>
