import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { deleteVehicleType, fetchVehicleAssignmentRows, fetchVehicleTypeAssignments, fetchVehicleTypes, saveVehicleType, setVehicleType } from '@/features/vehicle-types/vehicle-types-api'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend, type FakeCall, type FakeRoutes } from '@/test/fake-backend'
import { deleteVehicle, fetchVehicle, fetchVehicles, fetchVehicleStates, FLEET_CAPABILITIES, saveVehicle, saveVehicleMaintenance } from './vehicles-api'

/**
 * Đội xe và loại xe nối backend (`usesBackend('fleet')`): đọc đủ mọi trang của hai `PageResponse` trần, ghép xe với loại xe đang gắn,
 * đọc cấu hình một xe kèm trục; xoá xe, bảo dưỡng, xoá loại xe gọi máy chủ; lệnh ghi theo hình của kho mẫu (form xe, form loại xe, gắn
 * loại) từ chối `NOT_SUPPORTED` mà không gọi mạng — màn máy chủ ghi qua `backend/`. DTO theo `VehicleResponse`, `VehicleTypeResponse`,
 * `TripVehicleConfigResponse` của backend.
 */
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

const BOX_TRUCK = {
  id: 7, name: 'Xe tải 5 tấn thùng kín', innerLength: 620, innerWidth: 235, innerHeight: 240, doorWidth: 230, doorHeight: 230,
  maxPayloadKg: 5000, frontAxleLimitKg: '6000.00', rearAxleLimitKg: 11000, maxCogOffsetRatio: 0.12, hazardousCapable: false, vehicleCount: 2,
  obstacles: [
    { id: 3, name: 'Hốc bánh trái', type: 'WHEEL_ARCH', x: 400, y: 0, z: 0, length: 100, width: 25, height: 30, loadBearing: true },
    { id: 4, name: 'Hộp đồ nghề', type: 'OTHER', x: '10.5', y: 100, z: 0, length: 20, width: 20, height: 20, loadBearing: null },
  ],
}
/** Loại chưa khai cửa và giới hạn trục — hai cột này rỗng được ở backend. */
const VAN = {
  id: 8, name: 'Xe van 1 tấn', innerLength: 300, innerWidth: 170, innerHeight: 160, doorWidth: null, doorHeight: null, maxPayloadKg: '1000.00',
  frontAxleLimitKg: null, rearAxleLimitKg: null, maxCogOffsetRatio: '0.1500', hazardousCapable: false, vehicleCount: 1, obstacles: [],
}
const HINO = { id: 11, name: 'Hino 500', licensePlate: '51C-123.45', vehicleTypeId: 7, vehicleTypeName: BOX_TRUCK.name, companyId: 1, companyName: 'Long Bình', status: 'AVAILABLE' }
const ISUZU = {
  ...HINO, id: 12, name: 'Isuzu NQR', licensePlate: '60C-446.32', status: 'IN_TRIP',
  currentTripId: 40, currentTripCode: 'TRIP-2026-0001', currentTripStatus: 'IN_TRANSIT',
}
const FORD = { ...HINO, id: 13, name: 'Ford Transit', licensePlate: '51D-118.63', vehicleTypeId: 8, vehicleTypeName: VAN.name, status: 'RETIRED' }

/** `PageResponse` trần của backend, chia sẵn thành các trang theo tham số `page`. */
function pages(...chunks: readonly unknown[][]) {
  return (call: FakeCall) => {
    const index = Number(call.query.page ?? 0)
    const data = chunks[index] ?? []
    const totalElements = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    return { body: { success: true, message: 'ok', data, page: index, size: Number(call.query.size), totalElements, totalPages: chunks.length, last: index >= chunks.length - 1 } }
  }
}

const ROUTES: FakeRoutes = {
  'GET /api/vehicles': pages([HINO, ISUZU], [FORD]),
  'GET /api/vehicle-types': pages([BOX_TRUCK, VAN]),
}

test('the fleet list reads every page of vehicles and joins each vehicle with its type, in cm and kg', async () => {
  const { calls } = stubBackend(ROUTES)
  const vehicles = await fetchVehicles()
  expect(calls.filter((call) => call.path === '/api/vehicles').map((call) => call.query.page)).toStrictEqual(['0', '1'])
  expect(vehicles.map((vehicle) => vehicle.id)).toStrictEqual(['11', '12', '13'])
  expect(vehicles[0]).toStrictEqual({
    id: '11',
    name: 'Hino 500 · 51C-123.45',
    innerLengthCm: 620,
    innerWidthCm: 235,
    innerHeightCm: 240,
    maxPayloadKg: 5000,
    doorWidthCm: 230,
    doorHeightCm: 230,
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: [
      { id: '3', type: 'WHEEL_ARCH', xCm: 400, yCm: 0, zCm: 0, lengthCm: 100, widthCm: 25, heightCm: 30, loadBearing: true },
      // Spec không có `OTHER`: đọc là vùng cấm xếp
      { id: '4', type: 'RESERVED_ZONE', xCm: 10.5, yCm: 100, zCm: 0, lengthCm: 20, widthCm: 20, heightCm: 20, loadBearing: false },
    ],
    frontAxleLimitKg: 6000,
    rearAxleLimitKg: 11000,
    maxCogOffsetRatio: 0.12,
  })
  // Loại chưa khai cửa: cửa là mặt cắt lòng thùng kèm dấu để màn nói rõ; không có giới hạn trục
  expect(vehicles[2]).toMatchObject({ name: 'Ford Transit · 51D-118.63', doorWidthCm: 170, doorHeightCm: 160, doorUnknown: true, maxPayloadKg: 1000, maxCogOffsetRatio: 0.15 })
  expect(vehicles[2]).not.toHaveProperty('frontAxleLimitKg')
  expect(vehicles[0]).not.toHaveProperty('axles')
})

test('the vehicle states come from the backend status, with the trip a running vehicle serves', async () => {
  stubBackend(ROUTES)
  expect(await fetchVehicleStates()).toStrictEqual([
    { vehicleId: '11', status: 'available' },
    { vehicleId: '12', status: 'in_use', tripId: 'TRIP-2026-0001', tripPhase: 'delivering' },
    { vehicleId: '13', status: 'retired' },
  ])
})

const CONFIG = {
  vehicleId: 11, vehicleName: 'Hino 500', licensePlate: '51C-123.45', vehicleTypeId: 7, vehicleTypeName: BOX_TRUCK.name,
  innerLength: 620, innerWidth: 235, innerHeight: 240, doorWidth: 230, doorHeight: 230, maxPayloadKg: 5000, frontAxleLimitKg: 6000,
  rearAxleLimitKg: null, maxCogOffsetRatio: 0.15, frontAxleX: '-100.00', rearAxleX: 450, emptyFrontAxleLoadKg: 2500, emptyRearAxleLoadKg: '1800.5',
  obstacles: [{ id: 3, name: 'Hốc bánh trái', type: 'WHEEL_ARCH', x: 400, y: 0, z: 0, length: 100, width: 25, height: 30, loadBearing: true }],
}

test('one vehicle reads its config with the two axles of its type', async () => {
  const { calls } = stubBackend({ 'GET /api/vehicles/11/config': { body: envelope(CONFIG) } })
  const vehicle = await fetchVehicle('11')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toStrictEqual(['GET /api/vehicles/11/config'])
  expect(vehicle).toMatchObject({ id: '11', name: 'Hino 500 · 51C-123.45', frontAxleLimitKg: 6000, obstacles: [{ id: '3', type: 'WHEEL_ARCH' }] })
  // Giới hạn trục sau chưa khai: tải tối đa của trục 0 kg là "chưa khai"
  expect(vehicle.axles).toStrictEqual([
    { id: 'front', name: '', positionXCm: -100, emptyLoadKg: 2500, maxLoadKg: 6000 },
    { id: 'rear', name: '', positionXCm: 450, emptyLoadKg: 1800.5, maxLoadKg: 0 },
  ])
})

test('a config without both axle positions and empty loads has no axles', async () => {
  stubBackend({ 'GET /api/vehicles/11/config': { body: envelope({ ...CONFIG, rearAxleX: null }) } })
  expect(await fetchVehicle('11')).not.toHaveProperty('axles')
})

test('the vehicle types list each type with the vehicles on it, and every vehicle has its type', async () => {
  stubBackend(ROUTES)
  const rows = await fetchVehicleTypes()
  expect(rows.map((row) => [row.type.id, row.vehicles.map((vehicle) => vehicle.name)])).toStrictEqual([
    ['7', ['Hino 500 · 51C-123.45', 'Isuzu NQR · 60C-446.32']],
    ['8', ['Ford Transit · 51D-118.63']],
  ])
  expect(rows[0]?.type).toStrictEqual({
    id: '7', name: 'Xe tải 5 tấn thùng kín', cargoLengthCm: 620, cargoWidthCm: 235, cargoHeightCm: 240, payloadKg: 5000,
    frontAxleLimitKg: 6000, rearAxleLimitKg: 11000, maxCogOffsetRatio: 0.12,
  })
  expect(rows[1]?.type).not.toHaveProperty('frontAxleLimitKg')
  expect(await fetchVehicleAssignmentRows()).toStrictEqual([
    { vehicle: { id: '13', name: 'Ford Transit · 51D-118.63' }, vehicleTypeId: '8' },
    { vehicle: { id: '11', name: 'Hino 500 · 51C-123.45' }, vehicleTypeId: '7' },
    { vehicle: { id: '12', name: 'Isuzu NQR · 60C-446.32' }, vehicleTypeId: '7' },
  ])
})

test('a role the server rejects gets the access error, not an empty fleet', async () => {
  stubBackend({ 'GET /api/vehicles': { status: 403, body: { success: false, message: 'Access Denied' } }, 'GET /api/vehicle-types': pages([BOX_TRUCK]) })
  await expect(fetchVehicles()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  await expect(fetchVehicleTypes()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
})

test('deleting a vehicle or a vehicle type calls the server, and its refusal keeps the business code', async () => {
  const { calls } = stubBackend({
    'DELETE /api/vehicles/11': { body: envelope({ id: 11, outcome: 'DELETED' }) },
    'DELETE /api/vehicles/12': { status: 409, body: { success: false, code: 'VEHICLE_IN_USE', message: 'in use' } },
    'DELETE /api/vehicle-types/7': { status: 409, body: { success: false, code: 'VEHICLE_TYPE_IN_USE', message: 'in use' } },
    'DELETE /api/vehicle-types/8': { body: envelope(null) },
  })
  await deleteVehicle('11')
  await expect(deleteVehicle('12')).rejects.toMatchObject({ code: 'VEHICLE_IN_USE' })
  await expect(deleteVehicleType('7')).rejects.toMatchObject({ code: 'VEHICLE_TYPE_IN_USE' })
  await deleteVehicleType('8')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toStrictEqual([
    'DELETE /api/vehicles/11', 'DELETE /api/vehicles/12', 'DELETE /api/vehicle-types/7', 'DELETE /api/vehicle-types/8',
  ])
})

test('maintenance starts with a note and ends with a delete, returning the new state of the vehicle', async () => {
  const { calls } = stubBackend({
    'POST /api/vehicles/11/maintenance': {
      body: envelope({ ...HINO, status: 'MAINTENANCE', maintenanceNote: ' Thay dầu ', maintenanceSince: '2026-11-10T08:30:00' }),
    },
    'DELETE /api/vehicles/11/maintenance': { body: envelope(HINO) },
    'POST /api/vehicles/12/maintenance': { status: 409, body: { success: false, code: 'VEHICLE_BUSY', message: 'busy' } },
  })
  expect(await saveVehicleMaintenance('11', 'Thay dầu')).toStrictEqual({
    vehicleId: '11', status: 'maintenance', maintenance: { note: 'Thay dầu', since: '2026-11-10T01:30:00.000Z' },
  })
  expect(calls[0]?.body).toStrictEqual({ note: 'Thay dầu' })
  expect(await saveVehicleMaintenance('11', null)).toStrictEqual({ vehicleId: '11', status: 'available' })
  await expect(saveVehicleMaintenance('12', 'Thay lốp')).rejects.toMatchObject({ code: 'VEHICLE_BUSY' })
})

test('the store-shaped writes stay rejected without a network call; the server screens write through backend/', async () => {
  const { calls } = stubBackend({})
  expect(FLEET_CAPABILITIES).toStrictEqual({ write: true, stateDetails: true, clearance: false })
  for (const call of [
    () => saveVehicle({ ...CONFIG_VEHICLE }),
    () => saveVehicleType({ name: 'Xe mới', cargoLengthCm: 400, cargoWidthCm: 200, cargoHeightCm: 200, payloadKg: 2000, maxCogOffsetRatio: 0.15 }),
    () => setVehicleType('11', '8'),
    () => fetchVehicleTypeAssignments(),
  ]) {
    await expect(call()).rejects.toMatchObject({ code: 'NOT_SUPPORTED' })
  }
  expect(calls).toStrictEqual([])
})

const CONFIG_VEHICLE = {
  id: '11', name: 'Hino 500 · 51C-123.45', innerLengthCm: 620, innerWidthCm: 235, innerHeightCm: 240, maxPayloadKg: 5000, doorWidthCm: 230,
  doorHeightCm: 230, doorPosition: 'REAR' as const, clearanceCm: 0, obstacles: [],
}
