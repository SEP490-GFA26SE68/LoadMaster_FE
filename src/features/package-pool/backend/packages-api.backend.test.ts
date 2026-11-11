import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { clearPackageFlag, fetchLabelsPdf, fetchPackage, fetchPackageHistory } from './packages-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

/** Cờ của kiện bản máy chủ: kiện kho bỏ khỏi chuyến mang cờ thiếu / hỏng; điều phối viên gỡ cờ bằng `DELETE /api/packages/{id}/flag`. */
const PACKAGE = {
  id: 5, orderId: null, packageTypeId: null, deliveryRequirementId: null, customerName: null, receivedPackageCount: null, expectedPackageCount: null,
  packageCode: 'LB-0005', trackingBarcode: null, qrToken: 'qr-5', actualLength: 60, actualWidth: 40, actualHeight: 30, actualWeightKg: 12.5,
  handlingClass: 'STANDARD', destination: '12 Lê Lợi, Quận 1', status: 'PENDING', flag: 'NOT_FOUND', isPinned: false, packageName: null, note: null,
  orientation: null, uprightOnly: null, fragilityLevel: null, stackable: null, maxTopLoadKg: null, maxLayers: null, minSupportRatio: null,
  priority: null, mustLoad: null, packingGroup: null,
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('kiện đọc kèm cờ của máy chủ; máy chủ cũ không trả cờ thì kiện không cờ', async () => {
  const { flag: _omitted, ...legacy } = PACKAGE
  stubBackend({
    'GET /api/packages/5': { body: envelope(PACKAGE) },
    'GET /api/packages/6': { body: envelope({ ...legacy, id: 6 }) },
  })
  expect((await fetchPackage('5')).flag).toBe('NOT_FOUND')
  expect((await fetchPackage('6')).flag).toBeNull()
})

test('gỡ cờ gọi DELETE …/flag và trả kiện không cờ', async () => {
  const { calls } = stubBackend({ 'DELETE /api/packages/5/flag': { body: envelope({ ...PACKAGE, flag: null }) } })
  const cleared = await clearPackageFlag('5')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['DELETE /api/packages/5/flag'])
  expect(cleared.flag).toBeNull()
})

test('lịch sử kiện: dòng nhật ký của máy chủ, mới nhất trước, giờ Việt Nam thành ISO', async () => {
  const { calls } = stubBackend({
    'GET /api/packages/5/history': { body: envelope([
      {
        id: 31, actionType: 'PACKAGE_FOUND', entityName: 'CargoPackage', entityId: '5', userId: 7, userName: 'Lê Văn Kho', userRole: 'WAREHOUSE_WORKER',
        companyId: 1, companyName: 'Long Bình', oldValues: null, newValues: { packageId: 5, packageCode: 'LB-0005', flag: 'NOT_FOUND' }, createdAt: '2026-11-12T08:30:00',
      },
      {
        id: 30, actionType: 'STAGING_SHORTAGE_REPORTED', entityName: 'StagingShortage', entityId: '2', userId: null, userName: null, userRole: null,
        companyId: 1, companyName: 'Long Bình', oldValues: null, newValues: { packageId: 5, tripId: 9 }, createdAt: '2026-11-11 17:00:00',
      },
    ]) },
  })
  const history = await fetchPackageHistory('5')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /api/packages/5/history'])
  expect(history.map((entry) => [entry.actionType, entry.at, entry.actorName, entry.actorRole])).toEqual([
    ['PACKAGE_FOUND', '2026-11-12T01:30:00.000Z', 'Lê Văn Kho', 'warehouse'],
    ['STAGING_SHORTAGE_REPORTED', '2026-11-11T10:00:00.000Z', null, null],
  ])
  expect(history[0]?.after).toEqual({ packageId: 5, packageCode: 'LB-0005', flag: 'NOT_FOUND' })
})

test('PDF nhãn: theo kiện là POST mã số, theo chuyến là GET theo mã chuyến; chuyến chưa có kiện là TRIP_HAS_NO_PACKAGES', async () => {
  const { calls } = stubBackend({
    'POST /api/packages/export/labels': { text: '%PDF-kien' },
    'GET /api/packages/export/labels/trip/TRIP-2026-0914': { text: '%PDF-chuyen' },
    'GET /api/packages/export/labels/trip/TRIP-RONG': { status: 409, body: { success: false, code: 'TRIP_HAS_NO_PACKAGES', message: 'Chuyến chưa có kiện' } },
  })
  expect(await (await fetchLabelsPdf({ packageIds: [5, 6] })).text()).toBe('%PDF-kien')
  expect(await (await fetchLabelsPdf({ tripId: 'TRIP-2026-0914' })).text()).toBe('%PDF-chuyen')
  await expect(fetchLabelsPdf({ tripId: 'TRIP-RONG' })).rejects.toMatchObject({ code: 'TRIP_HAS_NO_PACKAGES' })
  expect(calls.map((call) => [`${call.method} ${call.path}`, call.body])).toEqual([
    ['POST /api/packages/export/labels', { packageIds: [5, 6] }],
    ['GET /api/packages/export/labels/trip/TRIP-2026-0914', undefined],
    ['GET /api/packages/export/labels/trip/TRIP-RONG', undefined],
  ])
})
