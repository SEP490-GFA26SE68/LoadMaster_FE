import type { Dictionary } from '../types'
import type { sourcing as source } from '../vi/sourcing'

export const sourcing = {
  companyKinds: { manufacturer: 'Manufacturer', logistics: 'Logistics company' },
  packageTypes: {
    title: 'Package types',
    count: { one: '{count} package type in the catalog', other: '{count} package types in the catalog' },
    empty: 'No package types yet.',
  },
  packages: {
    title: 'Packages',
    count: { one: '{count} registered package', other: '{count} registered packages' },
    empty: 'No packages have been registered yet.',
    status: {
      registered: 'Registered',
      in_shipment: 'With the logistics company',
      received: 'Received at the warehouse',
      planned: 'Planned',
      loaded: 'Loaded',
      delivered: 'Delivered',
    },
  },
  labels: {
    title: 'Print QR labels',
    count: { one: '{count} label ready to print', other: '{count} labels ready to print' },
  },
  shipments: {
    title: 'Shipments',
    count: { one: '{count} shipment', other: '{count} shipments' },
    empty: 'No shipments yet.',
    detailCount: { one: '{count} package in the shipment, {received} received', other: '{count} packages in the shipment, {received} received' },
    status: {
      draft: 'Draft',
      handed_over: 'Handed over',
      partially_received: 'Receiving',
      received: 'Fully received',
    },
  },
  receiving: {
    title: 'Receiving',
    count: { one: '{count} package waiting to be scanned in', other: '{count} packages waiting to be scanned in' },
    empty: 'No packages are waiting to be received.',
  },
} satisfies Dictionary<typeof source>
