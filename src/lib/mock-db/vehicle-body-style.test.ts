import { expect, test } from 'vitest'
import { createMockDb, isStale, type VehicleTypeInput } from '@/lib/mock-db'
import { optimizedTwoCartonTrip } from '@/test/mock-db-samples'

/** Kiểu thân xe của loại xe: chỉ đổi hình xe ở khung 3D — kho kiểm giá trị, không coi nó là đầu vào tối ưu. */

const VAN: VehicleTypeInput = { name: 'Van cỡ trung 1,5 tấn', cargoLengthCm: 320, cargoWidthCm: 170, cargoHeightCm: 170, payloadKg: 1500 }

test('a vehicle type stores a body style, changes it, and drops it when the input leaves it out', async () => {
  const db = createMockDb()
  const created = await db.createVehicleType({ ...VAN, bodyStyle: 'VAN_MID' })
  expect(created.bodyStyle).toBe('VAN_MID')
  expect((await db.getVehicleType(created.id)).bodyStyle).toBe('VAN_MID')

  const changed = await db.updateVehicleType(created.id, { ...VAN, bodyStyle: 'VAN_LARGE' })
  expect(changed.bodyStyle).toBe('VAN_LARGE')

  const cleared = await db.updateVehicleType(created.id, VAN)
  expect(cleared).not.toHaveProperty('bodyStyle')
  expect(await db.getVehicleType(created.id)).not.toHaveProperty('bodyStyle')
})

test('a body style outside the drawable list is VEHICLE_TYPE_INVALID on create and on update, and nothing is written', async () => {
  const db = createMockDb()
  const unknown = { ...VAN, bodyStyle: 'BOX_TRUCK' } as unknown as VehicleTypeInput
  const before = (await db.listVehicleTypes()).length
  await expect(db.createVehicleType(unknown)).rejects.toMatchObject({ code: 'VEHICLE_TYPE_INVALID', params: { field: 'bodyStyle' } })
  expect(await db.listVehicleTypes()).toHaveLength(before)

  const created = await db.createVehicleType({ ...VAN, bodyStyle: 'VAN_MINI_FLAT' })
  await expect(db.updateVehicleType(created.id, unknown)).rejects.toMatchObject({ code: 'VEHICLE_TYPE_INVALID', params: { field: 'bodyStyle' } })
  expect((await db.getVehicleType(created.id)).bodyStyle).toBe('VAN_MINI_FLAT')
})

test('setting, changing or clearing the body style of a vehicle type leaves the plans of its vehicles current', async () => {
  const db = createMockDb()
  // Chuyến hai thùng chạy trên VEHICLE-001, đang gắn loại VT-001
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  const { inputVersion } = await db.getTrip(trip.id)
  const type = await db.getVehicleType('VT-001')
  for (const bodyStyle of ['VAN_MINI_HOOD', 'VAN_LARGE', undefined] as const) {
    await db.updateVehicleType('VT-001', { ...type, ...(bodyStyle ? { bodyStyle } : {}) })
    const current = await db.getTrip(trip.id)
    expect(current.inputVersion).toBe(inputVersion)
    expect(isStale(revision, current)).toBe(false)
  }
  // Giới hạn hiệu lực của xe — đầu vào tối ưu — không mang kiểu thân
  expect(await db.getVehicle('VEHICLE-001')).not.toHaveProperty('bodyStyle')
})

test('no seeded vehicle type declares a body style: every seeded vehicle keeps the shape chosen from its size', async () => {
  const types = await createMockDb().listVehicleTypes()
  expect(types.length).toBeGreaterThan(0)
  expect(types.filter((type) => type.bodyStyle !== undefined)).toStrictEqual([])
})

test('a company edits the body style of its own vehicle types only', async () => {
  const db = createMockDb()
  db.restoreSession('US-PN-03')
  expect((await db.listVehicleTypes()).map((type) => type.id)).not.toContain('VT-001')
  const type = await createMockDb().getVehicleType('VT-001')
  await expect(db.updateVehicleType('VT-001', { ...type, bodyStyle: 'VAN_MID' })).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY' })
  db.restoreSession('US-0001')
  expect((await db.getVehicleType('VT-001')).bodyStyle).toBeUndefined()
})
