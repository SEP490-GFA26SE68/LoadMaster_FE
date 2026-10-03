import { afterEach, expect, test, vi } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { VehicleConfig, VehicleObstacle } from '@/domain/models'
import { createMockDb, getMockDb, MockDbError } from '@/lib/mock-db'

afterEach(() => {
  vi.useRealTimers()
})

/** A truck the seed does not have, with the hand pallet jack parked at the front left. */
function ollinTruck(obstacle: VehicleObstacle): Omit<VehicleConfig, 'id'> {
  return {
    name: 'Thaco Ollin 720 · 51D-118.62',
    innerLengthCm: 610,
    innerWidthCm: 210,
    innerHeightCm: 210,
    maxPayloadKg: 7200,
    doorWidthCm: 200,
    doorHeightCm: 200,
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: [obstacle],
  }
}

const PALLET_JACK_ZONE: VehicleObstacle = {
  id: 'OBS-001',
  type: 'RESERVED_ZONE',
  xCm: 0,
  yCm: 0,
  zCm: 0,
  lengthCm: 60,
  widthCm: 70,
  heightCm: 120,
  loadBearing: false,
}

test('a created vehicle gets the next vehicle id and keeps its own copy of the input', async () => {
  const db = createMockDb()
  const zone = { ...PALLET_JACK_ZONE }
  const created = await db.createVehicle(ollinTruck(zone))
  zone.heightCm = 999
  const expected = { ...ollinTruck(PALLET_JACK_ZONE), id: 'VEHICLE-009' }
  expect(created).toStrictEqual(expected)
  expect(await db.getVehicle('VEHICLE-009')).toStrictEqual(expected)
  // Xe mới đứng sau mọi xe seed (xe của Phương Nam mang mã `VEHICLE-PN-…`, `nextId` không tính) và thuộc công ty mặc định LOG-001
  expect((await db.listVehicles()).map(({ id }) => id).slice(-3)).toStrictEqual(['VEHICLE-PN-01', 'VEHICLE-PN-02', 'VEHICLE-009'])
  db.restoreSession('US-0001')
  expect((await db.listVehicles()).map(({ id }) => id).slice(-2)).toStrictEqual(['VEHICLE-008', 'VEHICLE-009'])
})

test('a vehicle is replaced as a whole on update and is gone after delete; both need an existing id', async () => {
  const db = createMockDb()
  // VEHICLE-008 is in maintenance and no trip uses it
  const moreLoad = { ...(await db.getVehicle('VEHICLE-008')), maxPayloadKg: 7500 }
  expect(await db.updateVehicle(moreLoad)).toStrictEqual(moreLoad)
  expect(await db.getVehicle('VEHICLE-008')).toStrictEqual(moreLoad)
  await db.deleteVehicle('VEHICLE-008')
  await expect(db.getVehicle('VEHICLE-008')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  const missing = { collection: 'vehicles', id: 'VEHICLE-404' }
  await expect(db.updateVehicle({ ...moreLoad, id: 'VEHICLE-404' })).rejects.toMatchObject({ code: 'NOT_FOUND', params: missing })
  await expect(db.deleteVehicle('VEHICLE-404')).rejects.toMatchObject({ code: 'NOT_FOUND', params: missing })
})

test('every -api.ts layer gets the same app-wide database', () => {
  expect(getMockDb()).toBe(getMockDb())
})

test('a call settles only after the configured latency', async () => {
  vi.useFakeTimers()
  const db = createMockDb({ latencyMs: 300 })
  let settled = false
  const listing = db.listVehicles().then(() => {
    settled = true
  })
  await vi.advanceTimersByTimeAsync(299)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(settled).toBe(true)
  await listing
})

/** Truck 6m as the store returns it: with the limits of its vehicle type VT-001 (no axle limits, the default 15% offset). */
const TRUCK_6M_WITH_TYPE_LIMITS = { ...SPEC_TRUCK_6M, maxCogOffsetRatio: 0.15 }

test('a record is read by its id', async () => {
  expect(await createMockDb().getVehicle('VEHICLE-001')).toStrictEqual(TRUCK_6M_WITH_TYPE_LIMITS)
})

test('a vehicle that a trip still uses cannot be deleted', async () => {
  const db = createMockDb()
  await expect(db.deleteVehicle('VEHICLE-002')).rejects.toMatchObject({
    code: 'VEHICLE_IN_USE',
    params: { vehicleId: 'VEHICLE-002', tripIds: ['TRIP-2026-0914', 'TRIP-002'] },
  })
  expect((await db.getVehicle('VEHICLE-002')).id).toBe('VEHICLE-002')
})

test('changing what a read returns does not change the stored record', async () => {
  const db = createMockDb()
  const vehicle = await db.getVehicle('VEHICLE-001')
  vehicle.maxPayloadKg = 1
  const [listed] = await db.listVehicles()
  listed?.obstacles.splice(0)
  expect(await db.getVehicle('VEHICLE-001')).toStrictEqual(TRUCK_6M_WITH_TYPE_LIMITS)
})

test('reading a record that does not exist rejects with a NOT_FOUND error naming the collection and the id', async () => {
  const reading = createMockDb().getVehicle('VEHICLE-404')
  await expect(reading).rejects.toBeInstanceOf(MockDbError)
  await expect(reading).rejects.toMatchObject({ code: 'NOT_FOUND', params: { collection: 'vehicles', id: 'VEHICLE-404' } })
})
