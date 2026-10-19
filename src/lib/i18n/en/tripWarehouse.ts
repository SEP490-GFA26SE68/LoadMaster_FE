import type { Dictionary } from '../types'
import type { tripWarehouse as source } from '../vi/tripWarehouse'

export const tripWarehouse = {
  select: 'Select departure warehouse',
  placeholder: 'Select a company warehouse',
  default: 'Default',
} satisfies Dictionary<typeof source>