import type { Dictionary } from '../types'
import type { status as source } from '../vi/status'

export const status = {
  DRAFT: 'Draft',
  PLANNED: 'Planned',
  LOADING: 'Loading',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  sub: {
    awaitingApproval: 'Awaiting approval',
    approved: 'Approved',
    stale: 'Stale — optimize again',
    loading: 'Loading {recorded} / {total}',
    loaded: 'Loaded — ready to depart',
    lateStops: 'Stops expected late',
  },
} satisfies Dictionary<typeof source>
