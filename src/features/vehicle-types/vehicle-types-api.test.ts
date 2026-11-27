import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { fetchVehicleBodyStyle } from './vehicle-types-api'

/**
 * Kiểu thân xe cho khung 3D, khi đội xe còn là kho mẫu: đọc theo loại **đang gắn** với chính xe đang vẽ, mỗi lần đọc — không chụp vào
 * phương án. Kho dùng chung của file, test chạy theo thứ tự.
 */

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Chưa nối backend thì không được gọi mạng')
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a vehicle whose type leaves the body style automatic, or that has no type, has no body style', async () => {
  const db = getMockDb()
  db.restoreSession('US-0001')
  expect(await fetchVehicleBodyStyle('VEHICLE-001')).toBeNull()
  // VEHICLE-008 của seed chưa gắn loại nào
  expect(await fetchVehicleBodyStyle('VEHICLE-008')).toBeNull()
})

test('the body style follows the type currently attached to the vehicle, for the warehouse worker and the driver too', async () => {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const type = await db.getVehicleType('VT-001')
  await db.updateVehicleType('VT-001', { ...type, bodyStyle: 'VAN_MID' })
  expect(await fetchVehicleBodyStyle('VEHICLE-001')).toBe('VAN_MID')
  for (const user of ['US-0003', 'US-0004']) {
    db.restoreSession(user)
    expect(await fetchVehicleBodyStyle('VEHICLE-001')).toBe('VAN_MID')
  }
  db.restoreSession('US-0001')
  await db.setVehicleType('VEHICLE-001', 'VT-002')
  expect(await fetchVehicleBodyStyle('VEHICLE-001')).toBeNull()
  await db.setVehicleType('VEHICLE-001', 'VT-001')
  expect(await fetchVehicleBodyStyle('VEHICLE-001')).toBe('VAN_MID')
})

test('another company does not see the body style of a vehicle that is not theirs', async () => {
  const db = getMockDb()
  db.restoreSession('US-PN-03')
  expect(await fetchVehicleBodyStyle('VEHICLE-001')).toBeNull()
})
