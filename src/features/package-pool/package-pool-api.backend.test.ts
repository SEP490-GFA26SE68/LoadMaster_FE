import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError, connectApiAuth } from '@/lib/api-client'
import {
  clearPackageFlag, fetchPackages, fetchPackageType, fetchPackageTypes, isUnknownPackage, lookupPackages, PACKAGE_POOL_SUPPORT, reportPackageFound, scanPackage,
} from './package-pool-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

type Call = {
  readonly method: string
  readonly path: string
  readonly query: Record<string, string>
  readonly body: unknown
  readonly form: FormData | undefined
  readonly auth: string | null
  readonly accept: string | null
}
type Reply = { readonly status?: number; readonly body?: unknown; readonly blob?: Blob }

let calls: Call[] = []
/** `"METHOD /path"` → phản hồi; đường không khai báo trả 404 như backend. */
let routes: Record<string, Reply | ((call: Call) => Reply)> = {}

beforeEach(() => {
  calls = []
  routes = {}
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const url = new URL(input)
    const headers = init.headers as Record<string, string>
    const call: Call = {
      method: init.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      form: init.body instanceof FormData ? init.body : undefined,
      auth: headers.Authorization ?? null,
      accept: headers.Accept ?? null,
    }
    calls.push(call)
    const route = routes[`${call.method} ${call.path}`]
    const reply = route === undefined ? { status: 404, body: { success: false, message: 'Không tìm thấy kiện hàng' } } : typeof route === 'function' ? route(call) : route
    if (reply.blob) return Promise.resolve(new Response(reply.blob, { status: reply.status ?? 200 }))
    return Promise.resolve(new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status ?? 200 }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const envelope = (data: unknown) => ({ success: true, message: 'ok', data })
const page = (content: unknown[], last = true) => ({ content, last, number: 0, totalPages: 1 })

const TOKEN_1 = '63abd059-f710-4bf5-abe1-a1c120f2c6d9'
const TOKEN_3 = '301a4619-a65b-4540-8d12-2f7060b268d5'
const MANUAL = {
  id: 1, orderId: null, packageTypeId: null, trackingBarcode: 'QA-BARCODE-0001', actualLength: 120.5, actualWeightKg: 12.5, isPinned: false,
  packageCode: 'QA PK-0001', qrToken: TOKEN_1, handlingClass: 'FRAGILE', status: 'PENDING',
}
const IMPORTED = { ...MANUAL, id: 3, orderId: 1, trackingBarcode: null, actualLength: 50, actualWeightKg: '3.00', packageCode: 'HK-7', qrToken: TOKEN_3, handlingClass: null, status: 'PLANNED' }
const scanOf = (dto: typeof MANUAL | typeof IMPORTED, extra: object = {}) => envelope({
  id: dto.id, packageCode: dto.packageCode, qrToken: dto.qrToken, handlingClass: dto.handlingClass ?? 'STANDARD', actualWeightKg: dto.actualWeightKg,
  status: dto.status, orderId: dto.orderId, trip: null, stop: null, destination: `Kho ${dto.id}`, ...extra,
})

test('danh sách: đọc mọi trang theo mã tăng dần, mm thành cm, bỏ kiện đã huỷ', async () => {
  routes['GET /api/packages'] = (call) => (call.query.page === '0' ? { body: page([MANUAL, { ...MANUAL, id: 2, status: 'CANCELLED' }], false) } : { body: page([IMPORTED]) })
  const packages = await fetchPackages()
  expect(packages.map((pkg) => [pkg.id, pkg.lengthCm, pkg.status, pkg.source])).toEqual([['1', 120.5, 'IMPORTED', 'IMPORT'], ['3', 50, 'ASSIGNED', 'IMPORT']])
  expect(calls.map((call) => call.query)).toEqual([{ sort: 'id,asc', page: '0', size: '200' }, { sort: 'id,asc', page: '1', size: '200' }])
  expect(calls[0]?.auth).toBe('Bearer token-1')
})

test('quét mã: mã viết hoa của ô quét đổi về chữ thường, cờ của kiện đi theo; không khớp là QR_UNKNOWN', async () => {
  routes[`GET /api/packages/scan/${TOKEN_1}`] = { body: scanOf(MANUAL, { flag: 'NOT_FOUND' }) }
  const found = await scanPackage(TOKEN_1.toUpperCase())
  expect(found.package).toMatchObject({ id: '1', destination: 'Kho 1', flags: ['NOT_FOUND'] })
  const error = await scanPackage('00000000-0000-4000-8000-000000000000').catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(ApiError)
  expect(isUnknownPackage(error)).toBe(true)
})

test('tra theo mã gõ: mã QR, mã của bên gửi, mã của kho; kiện của công ty khác (403) không khớp', async () => {
  routes[`GET /api/packages/scan/${TOKEN_1}`] = { body: scanOf(MANUAL) }
  routes[`GET /api/packages/scan/${TOKEN_3}`] = { body: scanOf(IMPORTED) }
  // Như máy chủ thật: danh sách không lọc theo mã của bên gửi, app tự lọc
  routes['GET /api/packages'] = { body: page([MANUAL, IMPORTED]) }
  routes['GET /api/packages/1'] = { body: MANUAL }
  routes['GET /api/packages/5'] = { status: 403, body: { success: false, message: 'Bạn không có quyền' } }

  expect((await lookupPackages(TOKEN_3)).map((item) => item.package.id)).toEqual(['3'])
  expect((await lookupPackages('hk-7')).map((item) => [item.package.id, item.package.destination])).toEqual([['3', 'Kho 3']])
  expect((await lookupPackages('1')).map((item) => item.package.id)).toEqual(['1'])
  await expect(lookupPackages('5')).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
  await expect(lookupPackages('khong-co')).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
})

test('loại kiện đọc từ máy chủ: cm nguyên, ba giới hạn đổi sang trường Spec', async () => {
  const type = {
    id: 4, companyId: 1, typeCode: 'PT-4', name: 'Thùng dễ vỡ', length: 60, width: 40, height: 30, weightKg: '2.5', maxStackingWeightKg: 0,
    isFragile: true, rotationAllowed: false,
  }
  routes['GET /api/package-types'] = { body: envelope(page([type])) }
  routes['GET /api/package-types/4'] = { body: envelope(type) }
  const [listed] = await fetchPackageTypes()
  expect(listed).toMatchObject({
    id: '4', companyId: '1', name: 'Thùng dễ vỡ', lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 2.5, maxStackWeightKg: 0, rotationAllowed: false,
    fragile: true, stackable: false, maxTopLoadKg: 0, allowedOrientations: ['LWH'], fragilityLevel: 'HIGH', keepUpright: false,
  })
  expect(await fetchPackageType('4')).toEqual(listed)
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /api/package-types', 'GET /api/package-types/4'])
})

test('kho báo tìm thấy kiện: POST theo mã của kho, cờ gỡ xong; kiện không mang cờ là 409 PACKAGE_NOT_FLAGGED', async () => {
  routes['POST /api/packages/1/found'] = { body: envelope({ ...MANUAL, flag: null }) }
  expect((await reportPackageFound({ id: '1', qrToken: TOKEN_1 })).flags).toEqual([])
  routes['POST /api/packages/3/found'] = { status: 409, body: { success: false, code: 'PACKAGE_NOT_FLAGGED', message: 'Kiện không mang cờ nào' } }
  await expect(reportPackageFound({ id: '3', qrToken: TOKEN_3 })).rejects.toMatchObject({ code: 'PACKAGE_NOT_FLAGGED' })
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /api/packages/1/found', 'POST /api/packages/3/found'])
})

test('gỡ cờ: DELETE cờ duy nhất của kiện; ở Tra cứu kiện chỉ điều phối viên (trips.edit) gỡ, như máy chủ', async () => {
  routes['DELETE /api/packages/3/flag'] = { body: envelope({ ...IMPORTED, flag: null }) }
  expect(await clearPackageFlag('3', 'DAMAGED')).toMatchObject({ id: '3', flags: [] })
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['DELETE /api/packages/3/flag'])
})

test('Tra cứu kiện theo máy chủ: chỉ có chiều dài, mã kho là số, không liên kết chuyến', () => {
  expect(PACKAGE_POOL_SUPPORT).toStrictEqual({ fullSize: false, tripLinks: false, numericIds: true })
})
