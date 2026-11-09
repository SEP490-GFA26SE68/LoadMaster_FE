import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { fetchServerStagingShortages, resolveServerStagingShortage } from './shortage-backend-api'

/** Thẻ "Kiện kho báo thiếu" theo máy chủ: DTO `StagingShortageResponse`, mốc giờ `LocalDateTime` giờ Việt Nam. */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('đọc báo thiếu theo mã chuyến: mã in trên nhãn đứng đầu, mã của báo thiếu giữ để quyết', async () => {
  const backend = stubBackend({
    'GET /api/trips/TRIP-20261106-A1/staging-shortages': {
      body: envelope([
        { id: 5, packageId: 11, packageCode: null, trackingBarcode: 'LB-PK-0007', packageName: 'Thùng dầu ăn', stopSequence: 2, reportedByName: 'Kho A', reportedAt: '2026-11-06 09:30:00', status: 'OPEN' },
        { id: 6, packageId: 12, packageCode: ' BG-12 ', trackingBarcode: null, packageName: null, stopSequence: null, reportedByName: null, reportedAt: null, status: 'OPEN' },
      ]),
    },
  })
  const rows = await fetchServerStagingShortages('TRIP-20261106-A1')
  expect(backend.calls.map((call) => call.path)).toStrictEqual(['/api/trips/TRIP-20261106-A1/staging-shortages'])
  expect(rows).toStrictEqual([
    { id: '5', packageInstanceId: 'LB-PK-0007', packageName: 'Thùng dầu ăn', packageCode: 'LB-PK-0007', stopNumber: 2, at: '2026-11-06T02:30:00.000Z', reporterName: 'Kho A' },
    { id: '6', packageInstanceId: 'BG-12', packageName: '', packageCode: 'BG-12', stopNumber: null, at: '1970-01-01T00:00:00.000Z', reporterName: null },
  ])
})

test('quyết gửi đúng đường dẫn và quyết định; báo thiếu đã quyết giữ mã của máy chủ', async () => {
  const backend = stubBackend({
    'POST /api/trips/1/staging-shortages/5/resolve': { body: envelope({ id: 5, status: 'DROPPED' }) },
    'POST /api/trips/1/staging-shortages/6/resolve': { status: 409, body: { success: false, code: 'STAGING_SHORTAGE_NOT_OPEN', message: 'x' } },
  })
  await resolveServerStagingShortage('1', '5', 'DROP')
  expect(backend.calls.map((call) => [call.method, call.path, call.body])).toStrictEqual([['POST', '/api/trips/1/staging-shortages/5/resolve', { decision: 'DROP' }]])
  const error = await resolveServerStagingShortage('1', '6', 'KEEP_SEARCHING').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('STAGING_SHORTAGE_NOT_OPEN')
})
