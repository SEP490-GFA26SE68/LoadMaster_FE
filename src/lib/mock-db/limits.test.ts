import { expect, test } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { VehicleAxle, VehicleConfig } from '@/domain/models'
import {
  axleLimitsFromAxles,
  backendLimitsOf,
  createMockDb,
  isStale,
  limitsOfType,
  orientationsFor,
  specFieldsOf,
  withTypeLimits,
  type PackageTypeInput,
} from '@/lib/mock-db'
import { optimizedTwoCartonTrip } from '@/test/mock-db-samples'

/** Giới hạn của loại xe và loại kiện theo backend (FE-5b-01): ánh xạ thuần, và kho áp chúng thế nào. */

const AXLES: VehicleAxle[] = [
  { id: 'AXLE-02', name: 'Trục sau 1', positionXCm: 400, emptyLoadKg: 900, maxLoadKg: 4500 },
  { id: 'AXLE-01', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 2000, maxLoadKg: 3000 },
  { id: 'AXLE-03', name: 'Trục sau 2', positionXCm: 520, emptyLoadKg: 900, maxLoadKg: 4500 },
]

const NEW_TYPE = { name: 'Xe tải 5 tấn ba trục', cargoLengthCm: 600, cargoWidthCm: 240, cargoHeightCm: 250, payloadKg: 5000 }

test('a vehicle takes the three limits of its type; a type without axle limits hands over only the offset ratio', () => {
  expect(withTypeLimits(SPEC_TRUCK_6M, { frontAxleLimitKg: 2800, rearAxleLimitKg: 8500, maxCogOffsetRatio: 0.12 })).toStrictEqual({
    ...SPEC_TRUCK_6M, frontAxleLimitKg: 2800, rearAxleLimitKg: 8500, maxCogOffsetRatio: 0.12,
  })
  expect(limitsOfType({ maxCogOffsetRatio: 0.15 })).toStrictEqual({ maxCogOffsetRatio: 0.15 })
})

test('a vehicle without a type carries no limit, and limits a caller put on the vehicle itself are dropped', () => {
  const tampered: VehicleConfig = { ...SPEC_TRUCK_6M, frontAxleLimitKg: 1, rearAxleLimitKg: 1, maxCogOffsetRatio: 0.4 }
  expect(withTypeLimits(tampered, undefined)).toStrictEqual(SPEC_TRUCK_6M)
})

test('seed axle limits come from the sample vehicle axles: first axle in front, the others summed; no axles, no limits', () => {
  expect(axleLimitsFromAxles({ axles: AXLES })).toStrictEqual({ frontAxleLimitKg: 3000, rearAxleLimitKg: 9000 })
  expect(axleLimitsFromAxles({})).toStrictEqual({})
  expect(axleLimitsFromAxles({ axles: AXLES.map((axle) => ({ ...axle, maxLoadKg: 0 })) })).toStrictEqual({})
})

test('no sample vehicle declares axles, so every seeded vehicle type has the default 15% offset and no axle limit', async () => {
  const db = createMockDb()
  expect((await db.listVehicles()).filter((vehicle) => vehicle.axles !== undefined)).toStrictEqual([])
  const types = await db.listVehicleTypes()
  expect(types.map((type) => type.maxCogOffsetRatio)).toStrictEqual(types.map(() => 0.15))
  expect(types.filter((type) => type.frontAxleLimitKg !== undefined || type.rearAxleLimitKg !== undefined)).toStrictEqual([])
})

test('the store hands vehicles out with the limits of their type and keeps none on the vehicle record', async () => {
  const db = createMockDb()
  const type = await db.createVehicleType({ ...NEW_TYPE, frontAxleLimitKg: 2800, rearAxleLimitKg: 8500, maxCogOffsetRatio: 0.12 })
  // VEHICLE-008 là xe seed chưa gắn loại
  expect(await db.getVehicle('VEHICLE-008')).not.toHaveProperty('maxCogOffsetRatio')
  await db.setVehicleType('VEHICLE-008', type.id)
  const limits = { frontAxleLimitKg: 2800, rearAxleLimitKg: 8500, maxCogOffsetRatio: 0.12 }
  expect(await db.getVehicle('VEHICLE-008')).toMatchObject(limits)
  expect((await db.listVehicles()).find((vehicle) => vehicle.id === 'VEHICLE-008')).toMatchObject(limits)
  // Lưu xe kèm giới hạn đọc được rồi gỡ loại: giới hạn không dính lại trên xe
  const saved = await db.updateVehicle({ ...(await db.getVehicle('VEHICLE-008')), name: 'Hyundai Mighty EX8 · 50H-118.30' })
  expect(saved).toMatchObject(limits)
  await db.setVehicleType('VEHICLE-008', null)
  const bare = await db.getVehicle('VEHICLE-008')
  expect([bare.frontAxleLimitKg, bare.rearAxleLimitKg, bare.maxCogOffsetRatio]).toStrictEqual([undefined, undefined, undefined])
})

test('a new vehicle type defaults to a 15% offset; axle limits must be above 0 and the offset within (0, 0.5]', async () => {
  const db = createMockDb()
  expect(await db.createVehicleType(NEW_TYPE)).toMatchObject({ maxCogOffsetRatio: 0.15 })
  const invalid = (input: Partial<Parameters<typeof db.createVehicleType>[0]>, field: string) =>
    expect(db.createVehicleType({ ...NEW_TYPE, ...input })).rejects.toMatchObject({ code: 'VEHICLE_TYPE_INVALID', params: { field } })
  await invalid({ frontAxleLimitKg: 0 }, 'frontAxleLimitKg')
  await invalid({ rearAxleLimitKg: -1 }, 'rearAxleLimitKg')
  await invalid({ maxCogOffsetRatio: 0 }, 'maxCogOffsetRatio')
  await invalid({ maxCogOffsetRatio: 0.51 }, 'maxCogOffsetRatio')
  expect(await db.createVehicleType({ ...NEW_TYPE, maxCogOffsetRatio: 0.5 })).toMatchObject({ maxCogOffsetRatio: 0.5 })
})

test('changing the limits a vehicle gets from its type makes the plans of its planning trips stale; other edits do not', async () => {
  const db = createMockDb()
  // Chuyến hai thùng chạy trên VEHICLE-001, đang gắn loại VT-001
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  const type = await db.getVehicleType('VT-001')
  await db.updateVehicleType('VT-001', { ...type, name: 'Xe tải 5 tấn thùng 6 m (đời 2024)' })
  expect(isStale(revision, await db.getTrip(trip.id))).toBe(false)
  await db.updateVehicleType('VT-001', { ...type, rearAxleLimitKg: 6000 })
  expect(isStale(revision, await db.getTrip(trip.id))).toBe(true)
})

test('moving a vehicle to a type with other limits makes its plans stale; a type with the same limits does not', async () => {
  const db = createMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  // VT-002 cũng 15 %, chưa khai giới hạn trục: giới hạn hiệu lực của xe không đổi
  await db.setVehicleType('VEHICLE-001', 'VT-002')
  expect(isStale(revision, await db.getTrip(trip.id))).toBe(false)
  // Gỡ loại: xe về mặc định 15 % của domain, vẫn không đổi
  await db.setVehicleType('VEHICLE-001', null)
  expect(isStale(revision, await db.getTrip(trip.id))).toBe(false)
  const strict = await db.createVehicleType({ ...NEW_TYPE, maxCogOffsetRatio: 0.1 })
  await db.setVehicleType('VEHICLE-001', strict.id)
  expect(isStale(revision, await db.getTrip(trip.id))).toBe(true)
})

const CARTON: PackageTypeInput = {
  name: 'Thùng mì gói 30 gói', lengthCm: 40, widthCm: 30, heightCm: 25, weightKg: 4, fragilityLevel: 'LOW', allowedOrientations: ['LWH', 'WLH'],
  keepUpright: true, stackable: true, maxStackCount: 6, maxTopLoadKg: 20,
}

test('backend limits of a package type are a projection of its Spec fields', () => {
  expect(backendLimitsOf(CARTON)).toStrictEqual({ maxStackWeightKg: 20, rotationAllowed: true, fragile: false })
  expect(backendLimitsOf({ ...CARTON, fragilityLevel: 'HIGH', allowedOrientations: ['LWH'], stackable: false, maxTopLoadKg: 0 }))
    .toStrictEqual({ maxStackWeightKg: 0, rotationAllowed: false, fragile: true })
})

test('backend limits map onto the Spec fields: top load, allowed orientations and fragility level', () => {
  expect(specFieldsOf({ maxStackWeightKg: 20, rotationAllowed: true, fragile: false }, { keepUpright: true })).toStrictEqual({
    maxTopLoadKg: 20, stackable: true, allowedOrientations: ['LWH', 'WLH'], fragilityLevel: 'NONE',
  })
  expect(specFieldsOf({ maxStackWeightKg: 0, rotationAllowed: false, fragile: true }, { keepUpright: false })).toStrictEqual({
    maxTopLoadKg: 0, stackable: false, allowedOrientations: ['LWH'], fragilityLevel: 'HIGH',
  })
  expect(orientationsFor(true, false)).toStrictEqual(['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL'])
})

test('backend limits survive the round trip through the Spec fields', () => {
  for (const maxStackWeightKg of [0, 37.5]) {
    for (const rotationAllowed of [true, false]) {
      for (const fragile of [true, false]) {
        for (const keepUpright of [true, false]) {
          const limits = { maxStackWeightKg, rotationAllowed, fragile }
          expect(backendLimitsOf(specFieldsOf(limits, { keepUpright }))).toStrictEqual(limits)
        }
      }
    }
  }
})

test('the store writes the backend limits of a package type every time it is saved', async () => {
  const db = createMockDb()
  const created = await db.createPackageType(CARTON)
  expect(created).toMatchObject({ maxStackWeightKg: 20, rotationAllowed: true, fragile: false })
  const updated = await db.updatePackageType(created.id, { ...CARTON, fragilityLevel: 'HIGH', allowedOrientations: ['LWH'], stackable: false, maxTopLoadKg: 0 })
  expect(updated).toMatchObject({ maxStackWeightKg: 0, rotationAllowed: false, fragile: true })
  // Seed: mọi loại kiện mang đúng hình chiếu của chính nó
  for (const type of await db.listPackageTypes()) expect(type).toMatchObject(backendLimitsOf(type))
})
