import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import {
  approvePickupRequest,
  createPickupRequest,
  fetchPickupRows,
  getPickupRequest,
  PICKUPS_ON_BACKEND,
  rejectPickupRequest,
  validatePickupRequest,
} from './pickups-api'

/**
 * Nhận hàng dọc đường nối backend theo nhóm `trips`: mỗi hàm gọi đúng endpoint của `PickupRequestController`, đổi DTO sang kiểu của màn
 * (mã số thành chuỗi, giờ Việt Nam không múi giờ thành ISO 8601, mã luật lạ bị bỏ), và lỗi của máy chủ giữ mã.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

const TRIP = 'TRIP-20261106-0A1B'
const BASE = `/api/trips/${TRIP}/pickup-requests`

const point = (name: string) => ({ name, address: `${name}, Thủ Đức`, latitude: 10.85, longitude: 106.77 })

const dto = (over: Record<string, unknown> = {}) => ({
  id: 7,
  tripId: 12,
  tripCode: TRIP,
  status: 'PENDING',
  pickup: point('Kho Linh Trung'),
  delivery: point('Bách Hoá Xanh Thủ Đức'),
  deadline: '2026-11-06T17:00:00',
  packages: [
    { lineIndex: 1, packageCode: 'SHIP-2', lengthCm: 40, widthCm: 30, heightCm: 20, weightKg: 5, handlingClass: 'FRAGILE' },
    { lineIndex: 0, packageCode: 'SHIP-1', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' },
  ],
  validationResults: [
    { rule: 1, passed: true, code: 'PICKUP_ON_ROUTE', params: { distanceKm: 1.2 } },
    { rule: 9, passed: false, code: 'PICKUP_DEADLINE_MISSED', params: { eta: '2026-11-06T18:30:00', deadline: '2026-11-06T17:00:00', stopId: '41' } },
    { rule: 4, passed: true, code: 'PICKUP_SOMETHING_NEW', params: {} },
  ],
  createdById: 8,
  createdByName: 'Trần Văn Tài',
  createdAt: '2026-11-06 09:15:00',
  ...over,
})

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('yêu cầu nhận đi theo nhóm trips', () => {
  expect(PICKUPS_ON_BACKEND).toBe(true)
})

test('danh sách: mã số thành chuỗi, giờ Việt Nam thành ISO, kiện theo thứ tự dòng, mã luật lạ bị bỏ', async () => {
  const { calls } = stubBackend({ [`GET ${BASE}`]: { body: envelope([dto()]) } })

  const [row] = await fetchPickupRows(TRIP)

  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([`GET ${BASE}`])
  expect(row?.createdByName).toBe('Trần Văn Tài')
  const request = row?.request
  expect(request).toMatchObject({ id: '7', tripId: TRIP, status: 'PENDING', createdBy: '8', createdAt: '2026-11-06T02:15:00.000Z', deadline: '2026-11-06T10:00:00.000Z' })
  expect(request?.pickup).toEqual({ name: 'Kho Linh Trung', address: 'Kho Linh Trung, Thủ Đức', lat: 10.85, lng: 106.77 })
  expect(request?.packages.map((pkg) => pkg.packageCode)).toEqual(['SHIP-1', 'SHIP-2'])
  expect(request?.packages[1]?.handlingClass).toBe('FRAGILE')
  expect(request?.validationResults.map((rule) => rule.code)).toEqual(['PICKUP_ON_ROUTE', 'PICKUP_DEADLINE_MISSED'])
  expect(request?.validationResults[1]?.params).toEqual({ eta: '2026-11-06T11:30:00.000Z', deadline: '2026-11-06T10:00:00.000Z', stopId: '41' })
})

test('máy chủ trả danh sách rỗng hoặc null: không có yêu cầu nào', async () => {
  stubBackend({ [`GET ${BASE}`]: { body: envelope(null) } })
  expect(await fetchPickupRows(TRIP)).toEqual([])
})

test('tạo: thân theo hợp đồng của máy chủ, hạn là giờ Việt Nam không múi giờ', async () => {
  const { calls } = stubBackend({ [`POST ${BASE}`]: { body: envelope(dto({ status: 'VALIDATED' })) } })

  const request = await createPickupRequest(TRIP, {
    pickup: { name: 'Kho Linh Trung', address: 'Linh Trung, Thủ Đức', lat: 10.86, lng: 106.79 },
    delivery: { name: 'Bách Hoá Xanh', address: 'Võ Văn Ngân, Thủ Đức', lat: 10.85, lng: 106.76 },
    deadline: '2026-11-06T10:00:00.000Z',
    packages: [{ packageCode: 'SHIP-1', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' }],
  })

  expect(request.status).toBe('VALIDATED')
  expect(calls[0]?.body).toEqual({
    pickup: { name: 'Kho Linh Trung', address: 'Linh Trung, Thủ Đức', latitude: 10.86, longitude: 106.79 },
    delivery: { name: 'Bách Hoá Xanh', address: 'Võ Văn Ngân, Thủ Đức', latitude: 10.85, longitude: 106.76 },
    deadline: '2026-11-06T17:00:00',
    packages: [{ packageCode: 'SHIP-1', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' }],
  })
})

test('đọc một yêu cầu và kiểm lại luật bằng POST', async () => {
  const { calls } = stubBackend({
    [`GET ${BASE}/7`]: { body: envelope(dto()) },
    [`POST ${BASE}/7/validate`]: { body: envelope(dto({ status: 'VALIDATED' })) },
  })

  expect((await getPickupRequest(TRIP, '7')).id).toBe('7')
  expect((await validatePickupRequest(TRIP, '7')).status).toBe('VALIDATED')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([`GET ${BASE}/7`, `POST ${BASE}/7/validate`])
})

test('duyệt: gửi lý do vượt luật, trả kiện kho kiện máy chủ tạo kèm mã QR và chỗ xếp', async () => {
  const approved = dto({
    status: 'APPROVED',
    overrideReason: 'Khách quen, đã gọi trước',
    approvedById: 3,
    approvedAt: '2026-11-06T09:20:00',
    pickupStopId: 40,
    deliveryStopId: 41,
    packages: [{ lineIndex: 0, packageCode: 'SHIP-1', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD', cargoPackageId: 500, warehouseCode: 'SHIP-1', qrToken: 'qr-500' }],
    layout: {
      placements: [{ packageIndex: 0, rotation: 1, xCm: 10, yCm: 0, zCm: 0, placedLengthCm: 40, placedWidthCm: 60, placedHeightCm: 40 }],
      unplaced: [],
      plannedAt: '2026-11-06T09:20:00',
    },
  })
  const { calls } = stubBackend({ [`POST ${BASE}/7/approve`]: { body: envelope(approved) } })

  const { request, packages } = await approvePickupRequest(TRIP, '7', { overrideReason: 'Khách quen, đã gọi trước' })

  expect(calls[0]?.body).toEqual({ overrideReason: 'Khách quen, đã gọi trước' })
  expect(request).toMatchObject({ status: 'APPROVED', approvedBy: '3', packageIds: ['500'], pickupStopId: '40', deliveryStopId: '41' })
  expect(request.layout?.placements[0]).toMatchObject({ packageIndex: 0, orientation: 'WLH', xCm: 10 })
  expect(packages).toHaveLength(1)
  expect(packages[0]).toMatchObject({ id: '500', packageCode: 'SHIP-1', qrToken: 'qr-500', status: 'ASSIGNED', source: 'PICKUP' })
})

test('từ chối gửi lý do; lỗi của máy chủ giữ mã', async () => {
  const { calls } = stubBackend({
    [`POST ${BASE}/7/reject`]: { body: envelope(dto({ status: 'REJECTED', rejectReason: 'Xe đầy' })) },
    [`POST ${BASE}/8/approve`]: { status: 400, body: { success: false, code: 'PICKUP_REASON_REQUIRED', message: 'lỗi' } },
  })

  expect((await rejectPickupRequest(TRIP, '7', 'Xe đầy')).status).toBe('REJECTED')
  expect(calls[0]?.body).toEqual({ reason: 'Xe đầy' })
  const error: unknown = await approvePickupRequest(TRIP, '8').then(() => null, (reason: unknown) => reason)
  expect(isApiError(error) ? error.code : 'NO_ERROR').toBe('PICKUP_REASON_REQUIRED')
})
