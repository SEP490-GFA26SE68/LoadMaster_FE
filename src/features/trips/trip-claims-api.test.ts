import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { approveTripClaim, fetchPendingTripClaims, fetchTripClaims, rejectTripClaim } from './trip-claims-api'

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('đọc danh sách phiếu theo DTO thật, đổi ID và mốc giờ LocalDateTime sang kiểu của app', async () => {
  const backend = stubBackend({
    'GET /api/trips/12/claims': {
      body: envelope([
        {
          id: 9,
          tripId: 12,
          driverUserId: 34,
          driverName: 'Nguyễn An',
          driverPhone: '0901234567',
          status: 'PENDING',
          note: 'Có thể nhận ngay',
          createdAt: '2026-11-20 21:05:33',
          decidedById: null,
          decidedByName: null,
          decidedAt: null,
          rejectReason: null,
        },
      ]),
    },
  })

  const rows = await fetchTripClaims('12')

  expect(backend.calls.map((call) => [call.method, call.path])).toStrictEqual([
    ['GET', '/api/trips/12/claims'],
  ])
  expect(rows).toStrictEqual([
    {
      id: '9',
      tripId: '12',
      driverUserId: '34',
      driverName: 'Nguyễn An',
      driverPhone: '0901234567',
      status: 'PENDING',
      note: 'Có thể nhận ngay',
      createdAt: '2026-11-20T14:05:33.000Z',
      decidedById: null,
      decidedByName: null,
      decidedAt: null,
      rejectReason: null,
    },
  ])
})

test('duyệt và từ chối dùng đúng endpoint, body từ chối có reason', async () => {
  const backend = stubBackend({
    'POST /api/trips/12/claims/9/approve': { body: envelope({ id: 9 }) },
    'POST /api/trips/12/claims/10/reject': { body: envelope({ id: 10 }) },
  })

  await approveTripClaim('12', '9')
  await rejectTripClaim('12', '10', 'Không thể bố trí chuyến này')

  expect(backend.calls.map((call) => [call.method, call.path, call.body])).toStrictEqual([
    ['POST', '/api/trips/12/claims/9/approve', undefined],
    ['POST', '/api/trips/12/claims/10/reject', { reason: 'Không thể bố trí chuyến này' }],
  ])
})

test('đọc hàng đợi phiếu xin chuyến, đổi DTO và giờ LocalDateTime thành dòng của ứng dụng', async () => {
  const backend = stubBackend({
    'GET /api/trip-claims': {
      body: envelope([
        {
          claimId: 9,
          tripId: 42,
          tripCode: 'TRIP-0042',
          tripName: 'Chuyến Tân Bình – Quận 7',
          departureTime: '2026-11-21 08:30:00',
          originWarehouse: 'Kho Tân Bình',
          stopCount: 3,
          driverUserId: 34,
          driverName: 'Nguyễn An',
          driverPhone: '0901234567',
          note: 'Có thể nhận chuyến sớm',
          createdAt: '2026-11-20 21:05:33',
        },
      ]),
    },
  })

  const rows = await fetchPendingTripClaims()

  expect(backend.calls.map((call) => [call.method, call.path, call.query])).toStrictEqual([
    ['GET', '/api/trip-claims', { status: 'PENDING' }],
  ])
  expect(rows).toStrictEqual([
    {
      claimId: '9',
      tripId: '42',
      tripCode: 'TRIP-0042',
      tripName: 'Chuyến Tân Bình – Quận 7',
      departureTime: '2026-11-21T01:30:00.000Z',
      originWarehouse: 'Kho Tân Bình',
      stopCount: 3,
      driverUserId: '34',
      driverName: 'Nguyễn An',
      driverPhone: '0901234567',
      note: 'Có thể nhận chuyến sớm',
      createdAt: '2026-11-20T14:05:33.000Z',
    },
  ])
})
