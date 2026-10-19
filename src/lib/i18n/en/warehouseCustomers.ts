import type { Dictionary } from '../types'
import type {warehouseCustomers as source} from '../vi/warehouseCustomers'
export const warehouseCustomers = {
  title: 'Shipping customers',
  description: 'Track package receiving progress by delivery requirement.',
  requirementCount: '{count} delivery requirements',
  requirement: 'Delivery requirement #{id}',
  destination: 'Destination: {address}',
  packageCount: '{received} / {expected} packages',
  receivedCount: '{count} packages received',
  remaining: '{count} packages expected',
  complete: 'Expected package count reached',
  exceeded: '{count} packages above expected count',
  noExpected: 'No expected package count',
  unknownCustomer: 'Unnamed customer',
  loading: 'Loading customers...',
  loadError: 'Unable to load customer data',
  empty: 'No customers with delivery requirements yet.',
  status: {
    PENDING: 'Pending',
    ASSIGNED: 'Assigned to trip',
    IN_TRIP: 'In transit',
  },
} satisfies Dictionary<typeof source>