import type { Dictionary } from '../types'
import type { search as source } from '../vi/search'

export const search = {
  button: 'Search',
  title: 'Quick search',
  inputLabel: 'Quick search keywords',
  placeholder: 'Type a code or name…',
  hint: 'Search {scope}.',
  scope: {
    trips: 'trips (code, name, stop)',
    packages: 'packages (code)',
    vehicles: 'vehicles (name, plate)',
    users: 'users (name, email)',
    orders: 'orders (code, customer, address)',
    registered: 'registered packages (code, batch, QR code, type)',
    packageTypes: 'package types (code, name)',
  },
  groups: {
    trips: 'Trips',
    packages: 'Packages',
    vehicles: 'Vehicles',
    users: 'Users',
    orders: 'Orders',
    registered: 'Registered packages',
    packageTypes: 'Package types',
  },
  results: 'Quick search results',
  count: { one: '{count} result', other: '{count} results' },
  loading: 'Loading data to search…',
  error: 'Could not load data to search.',
  retry: 'Try again',
  noResults: 'No results for “{query}”.',
  keys: { move: 'select', open: 'open', close: 'close' },
  shortcut: 'Open anytime with {keys}',
} satisfies Dictionary<typeof source>
