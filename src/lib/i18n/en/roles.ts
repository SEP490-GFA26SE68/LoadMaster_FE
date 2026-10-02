import type { Dictionary } from '../types'
import type { roles as source } from '../vi/roles'

export const roles = {
  systemAdmin: 'System administrator',
  systemManager: 'Platform manager',
  systemSupporter: 'Customer support',
  companyAdmin: 'Company administrator',
  manager: 'Company manager',
  dispatcher: 'Dispatcher',
  warehouse: 'Warehouse staff',
  driver: 'Driver',
} satisfies Dictionary<typeof source>
