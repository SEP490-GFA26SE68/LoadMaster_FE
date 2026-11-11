import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { getMockDb } from '@/lib/mock-db'
import { searchSources } from './quick-search'
import { fetchSearchSources } from './search-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

/**
 * Tìm nhanh khi kho kiện nối backend: nhóm kho kiện đọc `GET /api/packages` thay kho mẫu; dòng đầu là mã của bên gửi, dòng phụ là
 * trạng thái và loại hàng (không phải mã QR); mở kiện ở Kho kiện theo mã QR (mã của kho là số ngắn); loại kiện đọc `GET /api/package-types`; máy chủ từ chối người xem (403) thì nhóm rỗng, không lỗi.
 */
const TOKEN = '63abd059-f710-4bf5-abe1-a1c120f2c6d9'
const PACKAGE = {
  id: 7, orderId: null, trackingBarcode: 'QA-BARCODE-0007', actualLength: 120.5, actualWeightKg: 12.5, packageCode: 'QA PK-0007', qrToken: TOKEN,
  handlingClass: 'FRAGILE', status: 'PENDING',
}
const PACKAGE_TYPE = {
  id: 4, companyId: 1, typeCode: 'PT-4', name: 'Thùng carton 60', length: 60, width: 40, height: 40, weightKg: 2, maxStackingWeightKg: 30,
  isFragile: false, rotationAllowed: true,
}

let status = 200
let paths: string[] = []

beforeEach(() => {
  status = 200
  paths = []
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string) => {
    const path = new URL(input).pathname
    paths.push(path)
    const body = status === 200
      ? { success: true, message: 'ok', data: { content: [path === '/api/package-types' ? PACKAGE_TYPE : PACKAGE], last: true, number: 0, totalPages: 1 } }
      : { success: false, message: 'Access Denied' }
    return Promise.resolve(new Response(JSON.stringify(body), { status }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('kho kiện và loại kiện của tìm nhanh đọc từ backend, kiện mở ở Kho kiện theo mã QR; không đọc kho mẫu', async () => {
  const db = getMockDb()
  const listPackages = vi.spyOn(db, 'listPackages')
  const listPackageTypes = vi.spyOn(db, 'listPackageTypes')
  const sources = await fetchSearchSources(['pool', 'packageTypes'])
  expect(paths.toSorted()).toEqual(['/api/package-types', '/api/packages'])
  expect(sources.pool).toEqual([
    { id: '7', label: 'QA PK-0007', qrToken: TOKEN, typeName: '', query: TOKEN, status: 'IMPORTED', handlingClass: 'FRAGILE' },
  ])
  expect(sources.packageTypes).toEqual([{ id: '4', name: 'Thùng carton 60' }])
  expect(listPackages).not.toHaveBeenCalled()
  expect(listPackageTypes).not.toHaveBeenCalled()
  const [group] = searchSources(sources, 'qa pk', ['pool'])
  expect(group?.results.map((result) => result.href)).toEqual([`/kien-hang?q=${TOKEN}`])
})

test('máy chủ từ chối người xem (403): nhóm kho kiện rỗng, không lỗi', async () => {
  status = 403
  const sources = await fetchSearchSources(['pool', 'packageTypes'])
  expect(paths.toSorted()).toEqual(['/api/package-types', '/api/packages'])
  expect(sources.pool).toEqual([])
  expect(sources.packageTypes).toEqual([])
})

test('nhóm không cần kho kiện thì không gọi backend', async () => {
  vi.spyOn(getMockDb(), 'listVehicles').mockResolvedValue([])
  await fetchSearchSources(['vehicles'])
  expect(paths).toEqual([])
})
