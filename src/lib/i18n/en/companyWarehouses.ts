
import type { Dictionary } from '../types'
import type { companyWarehouses as source } from '../vi/companyWarehouses'

export const companyWarehouses = {
    title: 'Warehouse Management',
    add: 'Add warehouse',
    edit: 'Edit warehouse',
    name: 'Warehouse name',
    address: 'Warehouse address',
    coordinates: 'Warehouse location',
    coordinatesHint: 'Search using Goong or select a point on the map.',
    formDescription: 'Manage your company warehouse information and location.',
    save: 'Save warehouse',
    cancel: 'Cancel',
    created: 'Warehouse created successfully.',
    updated: 'Warehouse updated successfully.',
    invalidInput: 'Please check the warehouse name, address, and coordinates.',
    default: 'Default warehouse',
    active: 'Active',
    inactive: 'Inactive',
    setDefault: 'Set as default',
    deactivate: 'Deactivate',
    activate: 'Activate',
    empty: 'No warehouses have been registered yet.',
    pageDescription: 'Manage your company departure warehouses and their locations.',
    defaultUpdated: 'Default warehouse updated.',
    activated: 'Warehouse activated.',
    deactivated: 'Warehouse deactivated.',
    locationConfirmed: 'Warehouse coordinates available',
    locationMissing: 'Warehouse coordinates not yet available',
    retry: 'Retry',
} satisfies Dictionary<typeof source>
