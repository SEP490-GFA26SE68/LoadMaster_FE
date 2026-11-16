import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { deleteVehicle, endVehicleMaintenance, startVehicleMaintenance, updateVehicle } from './vehicles-api'

/** Ghi xe của màn Đội xe máy chủ: sửa (PUT), xoá (xe còn trong lịch sử chuyến thì máy chủ chuyển Ngừng sử dụng), bảo dưỡng. */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['fleet']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'fleet',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const HINO = { id: 11, name: 'Hino 500', licensePlate: '51C-123.45', vehicleTypeId: 7, vehicleTypeName: 'Xe tải 5 tấn', companyId: 1, companyName: 'Long Bình', status: 'AVAILABLE' }

test('editing a vehicle sends the trimmed name, the upper-case plate and the type id', async () => {
  const { calls } = stubBackend({ 'PUT /api/vehicles/11': { body: envelope({ ...HINO, name: 'Hino 500 mới', vehicleTypeId: 8 }) } })
  const vehicle = await updateVehicle('11', { name: '  Hino 500 mới ', licensePlate: ' 51c-123.45', vehicleTypeId: '8' })
  expect(calls[0]?.body).toStrictEqual({ name: 'Hino 500 mới', licensePlate: '51C-123.45', vehicleTypeId: 8 })
  expect(vehicle).toMatchObject({ id: '11', name: 'Hino 500 mới', vehicleTypeId: '8', status: 'AVAILABLE' })
})

test('deleting tells whether the vehicle was removed or retired, and a refusal keeps its code', async () => {
  stubBackend({
    'DELETE /api/vehicles/11': { body: envelope({ id: 11, outcome: 'RETIRED' }) },
    'DELETE /api/vehicles/13': { body: envelope({ id: 13, outcome: 'DELETED' }) },
    'DELETE /api/vehicles/12': { status: 409, body: { success: false, code: 'VEHICLE_IN_USE', message: 'in use' } },
  })
  expect(await deleteVehicle('11')).toBe('RETIRED')
  expect(await deleteVehicle('13')).toBe('DELETED')
  await expect(deleteVehicle('12')).rejects.toMatchObject({ code: 'VEHICLE_IN_USE' })
})

test('maintenance carries its note and start; a running vehicle names its trip', async () => {
  const { calls } = stubBackend({
    'POST /api/vehicles/11/maintenance': { body: envelope({ ...HINO, status: 'MAINTENANCE', maintenanceNote: 'Thay lốp', maintenanceSince: '2026-11-10 08:30:00' }) },
    'DELETE /api/vehicles/11/maintenance': { body: envelope({ ...HINO, status: 'IN_TRIP', currentTripCode: 'TRIP-2026-0001', currentTripStatus: 'LOADING' }) },
    'POST /api/vehicles/12/maintenance': { status: 409, body: { success: false, code: 'VEHICLE_BUSY', message: 'busy' } },
  })
  expect(await startVehicleMaintenance('11', 'Thay lốp')).toMatchObject({
    status: 'MAINTENANCE', maintenance: { note: 'Thay lốp', since: '2026-11-10T01:30:00.000Z' },
  })
  expect(calls[0]?.body).toStrictEqual({ note: 'Thay lốp' })
  const ended = await endVehicleMaintenance('11')
  expect(ended).toMatchObject({ status: 'IN_TRIP', currentTrip: { code: 'TRIP-2026-0001', status: 'LOADING' } })
  expect(ended).not.toHaveProperty('maintenance')
  await expect(startVehicleMaintenance('12', 'Thay lốp')).rejects.toMatchObject({ code: 'VEHICLE_BUSY' })
})
