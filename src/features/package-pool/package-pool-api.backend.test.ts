import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError, connectApiAuth } from '@/lib/api-client'
import {
  clearPackageFlag, confirmPackageImport, createPackage, deletePoolPackage, downloadPackageImportTemplate, exportPackageLabelsPdf, fetchPackageDetail,
  fetchPackageLabels, fetchPackages, fetchPackageTypes, isUnknownPackage, lookupPackages, PACKAGE_POOL_SUPPORT, previewPackageImport,
  reportPackageFound, savePackageType, scanPackage,
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
  id: 1, orderId: null, packageTypeId: null, trackingBarcode: 'QA-BARCODE-0001', actualLength: 1205, actualWeightKg: 12.5, isPinned: false,
  packageCode: 'QA PK-0001', qrToken: TOKEN_1, handlingClass: 'FRAGILE', status: 'PENDING',
}
const IMPORTED = { ...MANUAL, id: 3, orderId: 1, trackingBarcode: null, actualLength: 500, actualWeightKg: '3.00', packageCode: 'HK-7', qrToken: TOKEN_3, handlingClass: null, status: 'PLANNED' }
const scanOf = (dto: typeof MANUAL | typeof IMPORTED, extra: object = {}) => envelope({
  id: dto.id, packageCode: dto.packageCode, qrToken: dto.qrToken, handlingClass: dto.handlingClass ?? 'STANDARD', actualWeightKg: dto.actualWeightKg,
  status: dto.status, orderId: dto.orderId, trip: null, stop: null, destination: `Kho ${dto.id}`, ...extra,
})

test('danh sách: đọc mọi trang theo mã tăng dần, mm thành cm, bỏ kiện đã huỷ', async () => {
  routes['GET /api/packages'] = (call) => (call.query.page === '0' ? { body: page([MANUAL, { ...MANUAL, id: 2, status: 'CANCELLED' }], false) } : { body: page([IMPORTED]) })
  const packages = await fetchPackages()
  expect(packages.map((pkg) => [pkg.id, pkg.lengthCm, pkg.status, pkg.source])).toEqual([['1', 120.5, 'IMPORTED', 'MANUAL'], ['3', 50, 'ASSIGNED', 'IMPORT']])
  expect(calls.map((call) => call.query)).toEqual([{ sort: 'id,asc', page: '0', size: '200' }, { sort: 'id,asc', page: '1', size: '200' }])
  expect(calls[0]?.auth).toBe('Bearer token-1')
})

test('thêm kiện: cm thành mm, mã vạch ngẫu nhiên, trả kiện vừa tạo', async () => {
  routes['POST /api/packages'] = { status: 201, body: { ...MANUAL, id: 9, packageCode: 'HK-9' } }
  const created = await createPackage({ packageCode: ' HK-9 ', lengthCm: 120.5, widthCm: 80, heightCm: 60, weightKg: 12.5, handlingClass: 'FRAGILE', destination: ' Kho A ' })
  expect(created).toMatchObject({ id: '9', packageCode: 'HK-9', status: 'IMPORTED', qrToken: TOKEN_1 })
  expect(calls[0]?.body).toEqual({
    trackingBarcode: expect.stringMatching(/^[0-9a-f-]{36}$/), packageCode: 'HK-9', actualLength: 1205, actualWidth: 800, actualHeight: 600,
    actualWeightKg: 12.5, handlingClass: 'FRAGILE', destination: 'Kho A',
  })
})

test('xoá kiện: DELETE theo mã của kho, 204 không thân', async () => {
  routes['DELETE /api/packages/3'] = { status: 204 }
  await expect(deletePoolPackage('3')).resolves.toBeUndefined()
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['DELETE /api/packages/3'])
})

test('chi tiết kiện: kiện theo mã, điểm đến và chuyến từ lượt quét, không lịch sử', async () => {
  routes['GET /api/packages/3'] = { body: IMPORTED }
  routes[`GET /api/packages/scan/${TOKEN_3}`] = { body: scanOf(IMPORTED, { trip: { id: 12, name: 'TRIP-A' }, stop: { number: 2, name: 'Kho Thủ Đức' } }) }
  const detail = await fetchPackageDetail('3')
  expect(detail.package).toMatchObject({ id: '3', destination: 'Kho 3', tripId: '12', lengthCm: 50 })
  expect(detail).toMatchObject({ type: undefined, history: [] })
})

test('xem trước file: gửi multipart, giữ file cho bước xác nhận; file quá 1 MB bị chặn trước khi gửi', async () => {
  routes['POST /api/packages/import/preview'] = {
    body: envelope({ totalRows: 2, validCount: 1, errors: [{ rowIndex: 3, field: 'weightKg', errorCode: 'IMPORT_INVALID_WEIGHT', detail: null }], warnings: [], validRows: [
      { rowIndex: 2, packageCode: 'HK-1', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'Kho A' },
    ] }),
  }
  const file = new File(['packageCode\nHK-1'], 'kien.csv')
  const preview = await previewPackageImport(file)
  expect(preview).toMatchObject({ total: 2, valid: 1, errorRows: 1, file })
  expect(calls[0]?.form?.get('file')).toBeInstanceOf(File)
  const big = new File([new Uint8Array(1024 * 1024 + 1)], 'lon.csv')
  await expect(previewPackageImport(big)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', params: { maxMb: 1 } })
  expect(calls).toHaveLength(1)
})

test('xác nhận nhập: gửi lại file, kiện vừa tạo theo thứ tự backend trả; file còn lỗi là IMPORT_HAS_ERRORS', async () => {
  const file = new File(['x'], 'kien.csv')
  routes['POST /api/packages/import/confirm'] = { body: envelope({ totalImported: 2, packageIds: [3, 1], orderId: 1 }) }
  routes['GET /api/packages'] = { body: page([MANUAL, IMPORTED]) }
  const created = await confirmPackageImport({ kind: 'preview', rows: [], total: 2, valid: 2, errorRows: 0, warningRows: 0, file })
  expect(created.map((pkg) => pkg.id)).toEqual(['3', '1'])
  expect(calls[0]?.form?.get('file')).toBe(file)
  routes['POST /api/packages/import/confirm'] = { status: 422, body: { success: false, code: 'IMPORT_HAS_ERRORS', message: 'File import chứa 1 dòng lỗi', errors: [] } }
  await expect(confirmPackageImport({ kind: 'preview', rows: [], total: 1, valid: 1, errorRows: 0, warningRows: 0, file })).rejects.toMatchObject({ code: 'IMPORT_HAS_ERRORS', status: 422 })
})

test('file mẫu: tải .xlsx của backend', async () => {
  routes['GET /api/packages/import/template'] = { blob: new Blob(['PK']) }
  const blob = await downloadPackageImportTemplate('xlsx', [], 'packages')
  expect(await blob.text()).toBe('PK')
  expect(calls[0]?.accept).toBe('*/*')
})

test('quét mã: mã viết hoa của ô quét đổi về chữ thường; không khớp là QR_UNKNOWN', async () => {
  routes[`GET /api/packages/scan/${TOKEN_1}`] = { body: scanOf(MANUAL) }
  const found = await scanPackage(TOKEN_1.toUpperCase())
  expect(found.package).toMatchObject({ id: '1', destination: 'Kho 1' })
  const error = await scanPackage('00000000-0000-4000-8000-000000000000').catch((reason: unknown) => reason)
  expect(error).toBeInstanceOf(ApiError)
  expect(isUnknownPackage(error)).toBe(true)
})

test('tra theo mã gõ: mã QR, mã của bên gửi, mã của kho; kiện của công ty khác (403) không khớp', async () => {
  routes[`GET /api/packages/scan/${TOKEN_1}`] = { body: scanOf(MANUAL) }
  routes[`GET /api/packages/scan/${TOKEN_3}`] = { body: scanOf(IMPORTED) }
  routes['GET /api/packages'] = (call) => ({ body: page(call.query.packageCode === 'hk-7' ? [IMPORTED] : []) })
  routes['GET /api/packages/1'] = { body: MANUAL }
  routes['GET /api/packages/5'] = { status: 403, body: { success: false, message: 'Bạn không có quyền' } }

  expect((await lookupPackages(TOKEN_3)).map((item) => item.package.id)).toEqual(['3'])
  expect((await lookupPackages('hk-7')).map((item) => [item.package.id, item.package.destination])).toEqual([['3', 'Kho 3']])
  expect((await lookupPackages('1')).map((item) => item.package.id)).toEqual(['1'])
  await expect(lookupPackages('5')).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
  await expect(lookupPackages('khong-co')).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
})

test('nhãn: kiện theo thứ tự trên URL, bỏ mã lạ, điểm đến từ lượt quét; nhãn theo chuyến chưa có', async () => {
  routes['GET /api/packages'] = { body: page([MANUAL, IMPORTED]) }
  routes[`GET /api/packages/scan/${TOKEN_1}`] = { body: scanOf(MANUAL) }
  routes[`GET /api/packages/scan/${TOKEN_3}`] = { body: scanOf(IMPORTED) }
  const labels = await fetchPackageLabels({ ids: ['3', '99', '1'] })
  expect(labels.map((label) => [label.package.id, label.package.destination, label.owner])).toEqual([['3', 'Kho 3', undefined], ['1', 'Kho 1', undefined]])
  calls = []
  expect(await fetchPackageLabels({ tripId: 'TRIP-1' })).toEqual([])
  expect(calls).toEqual([])
})

test('PDF nhãn: POST mã số của kiện; quá 200 kiện bị chặn trước khi gửi', async () => {
  routes['POST /api/packages/export/labels'] = { blob: new Blob(['%PDF']) }
  expect(await (await exportPackageLabelsPdf(['1', '3'])).text()).toBe('%PDF')
  expect(calls[0]?.body).toEqual({ packageIds: [1, 3] })
  await expect(exportPackageLabelsPdf(Array.from({ length: 201 }, (_, index) => String(index + 1)))).rejects.toMatchObject({ code: 'EXPORT_TOO_MANY_PACKAGES' })
  expect(calls).toHaveLength(1)
})

test('phần backend chưa có: loại kiện rỗng, ghi loại kiện / gỡ cờ / báo tìm thấy không gọi mạng', async () => {
  expect(await fetchPackageTypes()).toEqual([])
  await expect(savePackageType({ name: 'Thùng', lengthCm: 1, widthCm: 1, heightCm: 1, weightKg: 1 } as never)).rejects.toThrow()
  await expect(clearPackageFlag('1', 'DAMAGED')).rejects.toThrow()
  await expect(reportPackageFound(TOKEN_1)).rejects.toThrow()
  expect(calls).toEqual([])
  expect(PACKAGE_POOL_SUPPORT).toMatchObject({
    packageTypes: false, flags: false, history: false, fullSize: false, deletePackage: true, pdfLabels: true, dispatcherOnly: true, tripLinks: false,
    statuses: ['IMPORTED', 'ASSIGNED', 'LOADED', 'DELIVERED'], maxImportMb: 1,
  })
})
