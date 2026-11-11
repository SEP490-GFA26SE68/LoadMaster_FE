import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import { fetchRequirementPackageChoices } from './requirement-pool-api'
import {
  createDeliveryRequirement, deleteDeliveryRequirement, extendRequirementDeadline, unassignRequirementFromTrip, updateDeliveryRequirement,
  updateRequirementCoordinates, updateRequirementSchedule,
} from './requirements-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Ghi yêu cầu giao vào máy chủ (điều phối viên): tạo kèm kiện chọn từ kho kiện, sửa chỉ gửi trường đổi, hạn theo giờ Việt Nam, mã số của
 * máy chủ trong đường dẫn, gỡ khỏi chuyến bằng endpoint của chuyến — không lối nào ghi vào kho mẫu. Ô chọn kiện chỉ lấy kiện còn chờ,
 * không cờ, chưa thuộc yêu cầu khác.
 */
const REQUIREMENT = {
  id: 41, companyId: 1, customerId: 9, customerName: 'Điện máy Xanh', destination: '12 Lê Lợi, Quận 1', destinationLat: 10.77, destinationLng: 106.7,
  deadline: '2026-11-20T17:00:00', priority: 'HIGH', status: 'PENDING', expectedPackageCount: 2, receivedPackageCount: 2, packageIds: [5, 6],
  note: null, tripId: null, tripCode: null, createdBy: 3, createdAt: '2026-11-05T08:00:00',
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('tạo yêu cầu gửi khách, điểm đến, toạ độ, hạn giờ Việt Nam và mã số kiện; không ghi kho mẫu', async () => {
  const createMock = vi.spyOn(getMockDb(), 'createDeliveryRequirement')
  const { calls } = stubBackend({ 'POST /api/delivery-requirements': { status: 201, body: envelope(REQUIREMENT) } })
  const saved = await createDeliveryRequirement({
    customerId: '9', expectedPackageCount: 2, destinationName: '12 Lê Lợi, Quận 1', address: ' 12 Lê Lợi, Quận 1 ', lat: 10.77, lng: 106.7,
    deadline: '2026-11-20T10:00:00Z', priority: 'HIGH', packageIds: ['5', '6'], note: '',
  })
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /api/delivery-requirements'])
  expect(calls[0]?.body).toEqual({
    customerId: 9, destination: '12 Lê Lợi, Quận 1', destinationLat: 10.77, destinationLng: 106.7, deadline: '2026-11-20T17:00:00', priority: 'HIGH',
    expectedPackageCount: 2, note: null, packageIds: [5, 6],
  })
  expect(saved).toMatchObject({ id: '41', packageIds: ['5', '6'], deadline: '2026-11-20T17:00:00+07:00', customerName: 'Điện máy Xanh' })
  expect(createMock).not.toHaveBeenCalled()
})

test('sửa yêu cầu: tập kiện chỉ đi khi có mặt, mảng rỗng là bỏ hết kiện', async () => {
  const { calls } = stubBackend({ 'PATCH /api/delivery-requirements/41': { body: envelope({ ...REQUIREMENT, packageIds: [] }) } })
  await updateDeliveryRequirement('41', { note: 'Gọi trước 30 phút' })
  await updateDeliveryRequirement('41', { packageIds: [] })
  expect(calls.map((call) => call.body)).toEqual([{ note: 'Gọi trước 30 phút' }, { packageIds: [] }])
})

test('hạn và ưu tiên, toạ độ, gia hạn, xoá: đúng endpoint theo mã số của máy chủ', async () => {
  const { calls } = stubBackend({
    'PATCH /api/delivery-requirements/41': { body: envelope(REQUIREMENT) },
    'PATCH /api/delivery-requirements/41/coordinates': { body: envelope(REQUIREMENT) },
    'PATCH /api/delivery-requirements/41/extend-deadline': { body: envelope(REQUIREMENT) },
    'DELETE /api/delivery-requirements/41': { body: envelope(null) },
  })
  await updateRequirementSchedule('41', { deadline: '2026-11-21T17:00:00', priority: 'URGENT' })
  await updateRequirementCoordinates('41', { destinationLat: 10.8, destinationLng: 106.6 })
  await extendRequirementDeadline('41', { newDeadline: '2026-11-22T09:00:00', reason: 'Khách hẹn lại' })
  await deleteDeliveryRequirement('41')
  expect(calls.map((call) => [`${call.method} ${call.path}`, call.body])).toEqual([
    ['PATCH /api/delivery-requirements/41', { deadline: '2026-11-21T17:00:00', priority: 'URGENT' }],
    ['PATCH /api/delivery-requirements/41/coordinates', { destinationLat: 10.8, destinationLng: 106.6 }],
    ['PATCH /api/delivery-requirements/41/extend-deadline', { newDeadline: '2026-11-22T09:00:00', reason: 'Khách hẹn lại' }],
    ['DELETE /api/delivery-requirements/41', undefined],
  ])
})

test('gỡ yêu cầu khỏi chuyến gọi endpoint của chuyến; máy chủ từ chối thì giữ mã lỗi', async () => {
  const unassignMock = vi.spyOn(getMockDb(), 'unassignDeliveryRequirement')
  const { calls } = stubBackend({
    'DELETE /api/trips/17/delivery-requirements/41': { body: envelope(null) },
    'DELETE /api/trips/18/delivery-requirements/41': { status: 409, body: { success: false, code: 'TRIP_NOT_EDITABLE', message: 'x' } },
  })
  await unassignRequirementFromTrip({ requirementId: '41', tripId: '17' })
  await expect(unassignRequirementFromTrip({ requirementId: '41', tripId: '18' })).rejects.toMatchObject({ code: 'TRIP_NOT_EDITABLE' })
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['DELETE /api/trips/17/delivery-requirements/41', 'DELETE /api/trips/18/delivery-requirements/41'])
  expect(unassignMock).not.toHaveBeenCalled()
})

test('máy chủ từ chối kiện của yêu cầu khác: mã lỗi đi tới màn', async () => {
  stubBackend({ 'POST /api/delivery-requirements': { status: 409, body: { success: false, code: 'PACKAGE_IN_OTHER_REQUIREMENT', message: 'x' } } })
  await expect(createDeliveryRequirement({
    customerId: '9', expectedPackageCount: 1, destinationName: 'A', address: 'A', deadline: '2026-11-20T10:00:00Z', priority: 'NORMAL', packageIds: ['5'],
  })).rejects.toMatchObject({ code: 'PACKAGE_IN_OTHER_REQUIREMENT' })
})

test('ô chọn kiện: chỉ kiện còn chờ, không cờ, chưa thuộc yêu cầu khác — kiện của chính yêu cầu đang sửa vẫn hiện', async () => {
  const pkg = (id: number, extra: Record<string, unknown>) => ({ id, packageCode: `HK-${id}`, actualLength: 40, actualWeightKg: 3, status: 'PENDING', ...extra })
  const { calls } = stubBackend({
    'GET /api/packages': { body: envelope(page([
      pkg(1, {}),
      pkg(2, { flag: 'DAMAGED' }),
      pkg(3, { deliveryRequirementId: 41 }),
      pkg(4, { deliveryRequirementId: 50 }),
      pkg(5, { status: 'PLANNED' }),
    ])) },
  })
  const forNew = await fetchRequirementPackageChoices()
  const forEdit = await fetchRequirementPackageChoices('41')
  expect(forNew.map((item) => [item.package.id, item.package.packageCode])).toEqual([['1', 'HK-1']])
  expect(forEdit.map((item) => item.package.id)).toEqual(['1', '3'])
  expect(calls.every((call) => call.path === '/api/packages')).toBe(true)
})
