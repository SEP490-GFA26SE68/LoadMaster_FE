import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { deleteVehicleType, saveVehicleType, type VehicleTypeInput } from './vehicle-types-api'

/** Ghi loại xe của màn máy chủ: thêm (POST), sửa (PUT cùng thân), xoá — loại còn gắn xe bị từ chối `VEHICLE_TYPE_IN_USE`. */
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

const INPUT: VehicleTypeInput = {
  name: 'Xe tải 5 tấn', cargoLengthCm: 620, cargoWidthCm: 235, cargoHeightCm: 240, doorWidthCm: 230, doorHeightCm: 230, payloadKg: 5000,
  frontAxleLimitKg: 6000, maxCogOffsetRatio: 0.15, hazardousCapable: false, obstacles: [],
}
const SAVED = {
  id: 7, name: 'Xe tải 5 tấn', innerLength: 620, innerWidth: 235, innerHeight: 240, doorWidth: 230, doorHeight: 230, maxPayloadKg: 5000,
  frontAxleLimitKg: 6000, rearAxleLimitKg: null, maxCogOffsetRatio: 0.15, hazardousCapable: false, vehicleCount: 2, obstacles: [],
}

test('a new type is posted and an existing one is put with the same body', async () => {
  const { calls } = stubBackend({
    'POST /api/vehicle-types': { body: envelope(SAVED) },
    'PUT /api/vehicle-types/7': { body: envelope({ ...SAVED, innerLength: 650 }) },
  })
  expect(await saveVehicleType(INPUT)).toMatchObject({ id: '7', cargoLengthCm: 620 })
  expect(await saveVehicleType({ ...INPUT, cargoLengthCm: 650 }, '7')).toMatchObject({ id: '7', cargoLengthCm: 650 })
  expect(calls.map((call) => `${call.method} ${call.path}`)).toStrictEqual(['POST /api/vehicle-types', 'PUT /api/vehicle-types/7'])
  expect(calls[1]?.body).toMatchObject({ name: 'Xe tải 5 tấn', innerLength: 650, maxPayloadKg: 5000, frontAxleLimitKg: 6000, rearAxleLimitKg: null })
})

test('deleting a type with vehicles keeps the business code', async () => {
  stubBackend({
    'DELETE /api/vehicle-types/7': { status: 409, body: { success: false, code: 'VEHICLE_TYPE_IN_USE', message: 'in use' } },
    'DELETE /api/vehicle-types/8': { body: envelope(null) },
  })
  await expect(deleteVehicleType('7')).rejects.toMatchObject({ code: 'VEHICLE_TYPE_IN_USE' })
  await expect(deleteVehicleType('8')).resolves.toBeUndefined()
})

test('lệch trọng tâm ngang và tải trọng sàn: gửi khi có, null khi trống; đọc BigDecimal dạng chuỗi, máy chủ cũ không trả là null', async () => {
  const { calls } = stubBackend({
    'POST /api/vehicle-types': { body: envelope({ ...SAVED, maxCogOffsetRatioY: '0.1250', floorLoadCapacityKgM2: '1500.00' }) },
    'PUT /api/vehicle-types/7': { body: envelope(SAVED) },
  })
  const created = await saveVehicleType({ ...INPUT, maxCogOffsetRatioY: 0.125, floorLoadCapacityKgM2: 1500 })
  const updated = await saveVehicleType(INPUT, '7')

  expect(calls[0]?.body).toMatchObject({ maxCogOffsetRatio: 0.15, maxCogOffsetRatioY: 0.125, floorLoadCapacityKgM2: 1500 })
  expect(calls[1]?.body).toMatchObject({ maxCogOffsetRatioY: null, floorLoadCapacityKgM2: null })
  expect(created).toMatchObject({ maxCogOffsetRatioY: 0.125, floorLoadCapacityKgM2: 1500 })
  expect(updated).toMatchObject({ maxCogOffsetRatioY: null, floorLoadCapacityKgM2: null })
})

test('kiểu thân xe: thêm gửi kiểu đã chọn, sửa về "Tự chọn" gửi clearBodyStyle; giá trị lạ hay máy chủ cũ đọc là tự chọn', async () => {
  const { calls } = stubBackend({
    'POST /api/vehicle-types': { body: envelope({ ...SAVED, bodyStyle: 'TRUCK_REEFER' }) },
    'PUT /api/vehicle-types/7': { body: envelope({ ...SAVED, bodyStyle: 'BUS' }) },
    'PUT /api/vehicle-types/8': { body: envelope({ ...SAVED, id: 8, bodyStyle: 'VAN_MID' }) },
  })
  const created = await saveVehicleType({ ...INPUT, bodyStyle: 'TRUCK_REEFER' })
  const cleared = await saveVehicleType(INPUT, '7')
  await saveVehicleType({ ...INPUT, bodyStyle: 'VAN_MID' }, '8')
  await saveVehicleType(INPUT)

  expect(calls[0]?.body).toMatchObject({ bodyStyle: 'TRUCK_REEFER' })
  expect(calls[0]?.body).not.toHaveProperty('clearBodyStyle')
  expect(calls[1]?.body).toMatchObject({ clearBodyStyle: true })
  expect(calls[1]?.body).not.toHaveProperty('bodyStyle')
  expect(calls[2]?.body).toMatchObject({ bodyStyle: 'VAN_MID' })
  expect(calls[2]?.body).not.toHaveProperty('clearBodyStyle')
  expect(calls[3]?.body).not.toHaveProperty('bodyStyle')
  expect(calls[3]?.body).not.toHaveProperty('clearBodyStyle')
  expect(created.bodyStyle).toBe('TRUCK_REEFER')
  expect(cleared).not.toHaveProperty('bodyStyle')
})
