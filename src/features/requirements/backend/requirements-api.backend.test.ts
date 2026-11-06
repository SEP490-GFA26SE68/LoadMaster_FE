import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import { fetchSearchSources } from '@/features/search/search-api'
import { assignRequirementToTrip, fetchAssignableTrips, updateDeliveryRequirement } from './requirements-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Yêu cầu giao khi nhóm `trips` nối backend: chuyến nhận yêu cầu là chuyến Nháp của máy chủ, đưa vào chuyến gọi đúng endpoint gắn yêu
 * cầu bằng mã số của máy chủ, sửa chỉ gửi trường có giá trị — và không lối nào ghi vào kho mẫu. Tìm nhanh đọc yêu cầu giao của máy chủ.
 */
const REQUIREMENT = {
  id: 41, companyId: 1, customerId: null, customerName: null, destination: '12 Lê Lợi, Quận 1', destinationLat: null, destinationLng: null,
  deadline: '2026-11-08T17:00:00', priority: 'HIGH', status: 'PENDING', expectedPackageCount: 2, receivedPackageCount: 2, packageIds: [5, 6],
  note: null, tripId: null, tripCode: null, createdBy: null, createdAt: '2026-11-05T08:00:00',
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('chuyến nhận được yêu cầu là chuyến Nháp của máy chủ: mã số để gắn, mã chuyến để hiện', async () => {
  const { calls } = stubBackend({
    'GET /api/trips': { body: envelope(page([{ id: 17, tripCode: 'TRIP-20261106-017', tripName: 'Tuyến Quận 1', status: 'DRAFT', departureTime: '2026-11-06T08:00:00' }])) },
  })
  const trips = await fetchAssignableTrips()
  expect(calls.map((call) => [call.path, call.query.status])).toEqual([['/api/trips', 'DRAFT']])
  expect(trips).toEqual([{ id: '17', code: 'TRIP-20261106-017', name: 'Tuyến Quận 1', scheduledDate: '2026-11-06', vehicleId: '' }])
})

test('đưa yêu cầu vào chuyến gọi endpoint gắn yêu cầu và trả điểm giao máy chủ sinh, không ghi kho mẫu', async () => {
  const assignMock = vi.spyOn(getMockDb(), 'assignDeliveryRequirement')
  const stop = { id: 3, tripId: 17, deliveryRequirementId: 41, stopSequence: 2, stopName: null, address: '12 Lê Lợi, Quận 1', latitude: null, longitude: null, status: 'PENDING', plannedArrival: null, actualArrival: null, deadline: null }
  const { calls } = stubBackend({ 'POST /api/trips/17/delivery-requirements/41': { body: envelope(stop) } })
  const saved = await assignRequirementToTrip({ requirementId: '41', tripId: '17' })
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /api/trips/17/delivery-requirements/41'])
  expect(saved.stopSequence).toBe(2)
  expect(assignMock).not.toHaveBeenCalled()
})

test('sửa yêu cầu chỉ gửi trường có giá trị, hạn theo giờ Việt Nam', async () => {
  const { calls } = stubBackend({ 'PATCH /api/delivery-requirements/41': { body: envelope({ ...REQUIREMENT, priority: 'URGENT' }) } })
  const saved = await updateDeliveryRequirement('41', { priority: 'URGENT', deadline: '2026-11-08T10:00:00Z' })
  expect(calls[0]?.body).toEqual({ priority: 'URGENT', deadline: '2026-11-08T17:00:00' })
  expect(saved.priority).toBe('URGENT')
})

test('tìm nhanh đọc yêu cầu giao của máy chủ, không đọc kho mẫu', async () => {
  const listMock = vi.spyOn(getMockDb(), 'listDeliveryRequirements')
  stubBackend({ 'GET /api/delivery-requirements': { body: { success: true, data: [REQUIREMENT], page: 0, size: 100, totalElements: 1, totalPages: 1, last: true } } })
  const sources = await fetchSearchSources(['requirements'])
  expect(sources.requirements).toEqual([{ id: '41', destinationName: '12 Lê Lợi, Quận 1', address: '12 Lê Lợi, Quận 1' }])
  expect(listMock).not.toHaveBeenCalled()
})
