import type { Dictionary } from '../types'
import type { common as source } from '../vi/common'

export const common = {
  packageCount: { one: '{count} package', other: '{count} packages' },
  stop: 'Stop {number}',
  stopWithName: 'Stop {number} · {name}',
  packageAtStop: '{id} · Stop {stop}',
  loadingScreen: 'Loading screen',
  processing: 'Processing',
  noData: 'No data yet',
  selectPlaceholder: 'Select…',
  backToTrips: 'Back to trips',
  on: 'On',
  off: 'Off',
  deliveryIssueKinds: { damaged: 'Damaged', missing: 'Missing', refused: 'Refused by customer', other: 'Other' },
  deadlineStatuses: { OK: 'On time', AT_RISK: 'Tight', MISSED: 'Expected late' },
  handlingClasses: { STANDARD: 'Standard', FRAGILE: 'Fragile', REFRIGERATED: 'Refrigerated', HAZARDOUS: 'Hazardous', HIGH_VALUE: 'High value' },
  packageStatuses: {
    IMPORTED: 'Imported',
    ASSIGNED: 'Assigned to trip',
    STAGED: 'Staged',
    LOADED: 'Loaded',
    IN_TRANSIT: 'In transit',
    DELIVERED: 'Delivered',
    RETURNED: 'Returned',
  },
  packageFlags: { NOT_FOUND: 'Not found', DAMAGED: 'Damaged' },
  table: {
    rowsPerPage: 'Rows per page',
    range: '{from}–{to} of {total}',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    noMatch: 'No results match the filters',
  },
  filters: {
    region: 'Search and filter',
    all: 'All',
    from: 'From date',
    to: 'To date',
    clear: 'Clear filters',
  },
} satisfies Dictionary<typeof source>
