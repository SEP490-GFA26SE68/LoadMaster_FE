import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { approveServerManualConfirmation, fetchServerManualConfirmations, rejectServerManualConfirmation } from './manual-confirm-backend-api'

/** Thẻ "Xác nhận tay chờ duyệt" theo máy chủ: DTO `ManualConfirmationResponse`, mốc giờ `LocalDateTime` giờ Việt Nam. */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['driver']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'driver',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('đọc xác nhận tay chờ duyệt theo mã chuyến: mã in trên nhãn đứng đầu, lý do lạ đọc là Khác', async () => {
  const backend = stubBackend({
    'GET /api/trips/TRIP-20261017-94EE14F0/manual-confirmations': {
      body: envelope([
        { id: 3, stopSequence: 2, packageId: 11, packageCode: null, trackingBarcode: 'LB-PK-0007', packageName: 'Thùng dầu ăn', reason: 'QR_UNREADABLE', note: null, requestedByName: 'Trần Văn Bình', requestedAt: '2026-10-17 14:25:00' },
        { id: 4, stopSequence: 2, packageId: 12, packageCode: 'BG-12', trackingBarcode: null, packageName: null, reason: 'MYSTERY', note: ' Nhãn ướt ', requestedByName: null, requestedAt: null },
      ]),
    },
  })
  const rows = await fetchServerManualConfirmations('TRIP-20261017-94EE14F0')
  expect(backend.calls.map((call) => call.path)).toStrictEqual(['/api/trips/TRIP-20261017-94EE14F0/manual-confirmations'])
  expect(rows).toStrictEqual([
    { id: '3', context: 'UNLOADING', stopNumber: 2, packageInstanceId: 'LB-PK-0007', packageName: 'Thùng dầu ăn', reason: 'QR_UNREADABLE', note: undefined, at: '2026-10-17T07:25:00.000Z', senderName: 'Trần Văn Bình' },
    { id: '4', context: 'UNLOADING', stopNumber: 2, packageInstanceId: 'BG-12', packageName: '', reason: 'OTHER', note: 'Nhãn ướt', at: '1970-01-01T00:00:00.000Z', senderName: null },
  ])
})

test('duyệt và từ chối gửi đúng đường dẫn; từ chối kèm lý do; xác nhận đã xử lý giữ mã của máy chủ', async () => {
  const backend = stubBackend({
    'POST /api/trips/1/manual-confirmations/3/approve': { body: envelope({ id: 3 }) },
    'POST /api/trips/1/manual-confirmations/4/reject': { body: envelope({ id: 4 }) },
    'POST /api/trips/1/manual-confirmations/5/approve': { status: 409, body: { success: false, code: 'MANUAL_CONFIRM_NOT_PENDING', message: 'đã xử lý' } },
  })
  await approveServerManualConfirmation('1', '3')
  await rejectServerManualConfirmation('1', '4', 'Ảnh không khớp')
  expect(backend.calls.map((call) => [call.method, call.path, call.body])).toStrictEqual([
    ['POST', '/api/trips/1/manual-confirmations/3/approve', undefined],
    ['POST', '/api/trips/1/manual-confirmations/4/reject', { reason: 'Ảnh không khớp' }],
  ])
  const failure = await approveServerManualConfirmation('1', '5').then(() => null, (error: unknown) => error)
  expect(isApiError(failure) ? failure.code : failure).toBe('MANUAL_CONFIRM_NOT_PENDING')
})

test('xác nhận tay của kho mang bước soạn / xếp và không mang số điểm; máy chủ cũ không có bước là bước dỡ', async () => {
  stubBackend({
    'GET /api/trips/8/manual-confirmations': {
      body: envelope([
        { id: 5, stopSequence: 1, packageId: 21, packageCode: 'BG-21', trackingBarcode: null, packageName: 'Thùng sữa', reason: 'LABEL_DAMAGED', note: null, requestedByName: 'Kho A', requestedAt: '2026-11-06 09:00:00', step: 'STAGING', placementId: null },
        { id: 6, stopSequence: 1, packageId: 22, packageCode: 'BG-22', trackingBarcode: null, packageName: 'Thùng mì', reason: 'QR_UNREADABLE', note: null, requestedByName: 'Kho A', requestedAt: '2026-11-06 09:05:00', step: 'LOADING', placementId: 71 },
        { id: 7, stopSequence: 2, packageId: 23, packageCode: 'BG-23', trackingBarcode: null, packageName: 'Thùng nước', reason: 'QR_UNREADABLE', note: null, requestedByName: 'Tài xế', requestedAt: '2026-11-06 15:00:00' },
      ]),
    },
  })
  const rows = await fetchServerManualConfirmations('8')
  expect(rows.map((row) => [row.context, row.stopNumber])).toStrictEqual([['STAGING', undefined], ['LOADING', undefined], ['UNLOADING', 2]])
})
