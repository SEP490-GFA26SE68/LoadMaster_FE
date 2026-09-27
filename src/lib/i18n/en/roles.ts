import type { Dictionary } from '../types'
import type { roles as source } from '../vi/roles'

export const roles = {
  dispatcher: 'Dispatcher',
  warehouse: 'Warehouse staff',
  driver: 'Driver',
  manager: 'Manager',
  admin: 'System administrator',
  manufacturer: 'Manufacturer',
  logistics: 'Logistics company',
} satisfies Dictionary<typeof source>
