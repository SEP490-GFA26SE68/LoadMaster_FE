import type { Dictionary } from '../types'
import type { orders as source } from '../vi/orders'

export const orders = {
  title: 'Orders',
  count: { one: '{count} order', other: '{count} orders' },
  pendingCount: { one: '{count} order waiting for a trip', other: '{count} orders waiting for a trip' },
  empty: 'No orders yet.',
  status: {
    pending: 'Waiting for a trip',
    assigned: 'Assigned to a trip',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  },
} satisfies Dictionary<typeof source>
