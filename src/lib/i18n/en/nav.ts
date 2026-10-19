import type { Dictionary } from '../types'
import type { nav as source } from '../vi/nav'

export const nav = {
  customers: 'Customers',
  label: 'Main navigation',
  dashboard: 'Dashboard',
  trips: 'Trips',
  warehouse: 'Warehouse',
  driver: 'Driver',
  fleet: 'Fleet',
  users: 'Users',
  audit: 'Log',
  packages: 'Package pool',
  requirements: 'Requirements',
  monitoring: 'Monitoring',
  plans: 'Plans',
  billing: 'Plan and credits',
  companies: 'Companies',
  support: 'Support',
  supportRequests: 'Support requests',
  contacts: 'Guest contacts',
  account: 'Account {name}',
  signOut: 'Sign out',
  profile: 'My profile',
  home: 'LoadMaster — back to home',
} satisfies Dictionary<typeof source>
