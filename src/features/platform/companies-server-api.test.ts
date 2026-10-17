import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import {
  createServerCompany,
  createServerCompanyAdmin,
  listServerCompanies,
  setServerCompanyStatus,
  updateServerCompany,
  type ServerCompany,
} from './companies-server-api'

/**
 * Màn Công ty nối backend: đúng endpoint, đúng thân, DTO của backend (develop) đổi sang `ServerCompany…`. Dạng phản hồi lấy từ backend
 * chạy ở máy (17/10/2026): danh sách công ty là trang của Spring không phong bì, hợp đồng là mảng trần, người dùng là `PageResponse`.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['companies']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'companies',
}))

type Call = { readonly method: string; readonly url: string; readonly body: unknown; readonly contentType: string | undefined }

let calls: Call[] = []
let handle: (method: string, url: string) => unknown = () => null

beforeEach(() => {
  calls = []
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>
    const method = init.method ?? 'GET'
    calls.push({ method, url: input, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined, contentType: headers['Content-Type'] })
    const reply = handle(method, input.replace('http://be.test', ''))
    return Promise.resolve(reply instanceof Response ? reply : new Response(JSON.stringify(reply), { status: 200 }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const failure = (status: number) => new Response(JSON.stringify({ success: false, message: 'lỗi' }), { status })

const LONG_BINH = {
  id: 1, companyCode: 'LM-LOGISTICS', companyName: 'Vận tải Long Bình', taxCode: 'TAX-LM-001', billingEmail: 'qtcongty@loadmaster.vn',
  status: 'ACTIVE', createdAt: '2026-10-16T21:05:16.181480Z',
}
const PHUONG_NAM = { ...LONG_BINH, id: 2, companyCode: 'FAST-MOVE', companyName: 'Logistics Phương Nam', taxCode: 'TAX-FM-001', status: 'SUSPENDED' }

const springPage = (content: unknown[], last: boolean, number: number) => ({ content, last, number, size: 200, totalPages: 2, empty: false })

const USER = {
  id: 6, keycloakId: 'kc-6', email: 'qtcongty@loadmaster.vn', fullName: 'Lý Thu Hà', phoneNumber: '0901234567', userRoleType: 'ADMIN',
  status: 'ACTIVE', companyId: 1, companyName: 'Vận tải Long Bình',
}
const usersPage = {
  success: true,
  data: [USER, { ...USER, id: 7, email: 'TaiXe@loadmaster.vn', userRoleType: 'DRIVER' }, { ...USER, id: 2, email: 'quantri@loadmaster.vn', userRoleType: 'SYSTEM_ADMIN', companyId: null }],
  page: 0, size: 500, totalElements: 3, totalPages: 1, last: true,
}

const CONTRACT = {
  id: 1, companyId: 1, companyCode: 'LM-LOGISTICS', planName: 'Pro', planTier: 'PRO', status: 'ACTIVE', startedAt: '2026-09-17T09:00:00',
  expiresAt: '2026-10-17T09:00:00', autoRenew: true,
}

function serve(routes: Record<string, unknown>) {
  handle = (method, url) => {
    const key = `${method} ${url}`
    if (!(key in routes)) throw new Error(`Không có phản hồi cho ${key}`)
    return routes[key]
  }
}

test('danh sách: đọc hết các trang công ty, ghép gói mới nhất và số người dùng của từng công ty', async () => {
  serve({
    'GET /api/companies?sort=id%2Casc&page=0&size=200': springPage([LONG_BINH], false, 0),
    'GET /api/companies?sort=id%2Casc&page=1&size=200': springPage([PHUONG_NAM], true, 1),
    'GET /api/contracts': [{ ...CONTRACT, planName: 'Basic', planTier: 'BASIC', startedAt: '2026-08-01T09:00:00' }, CONTRACT],
    'GET /api/users?page=0&size=500': usersPage,
  })
  const list = await listServerCompanies()

  expect(list.rows).toStrictEqual([
    {
      company: { id: '1', code: 'LM-LOGISTICS', name: 'Vận tải Long Bình', taxCode: 'TAX-LM-001', billingEmail: 'qtcongty@loadmaster.vn', status: 'ACTIVE', createdAt: '2026-10-16T21:05:16.181480Z' },
      // Giờ của hợp đồng là giờ Việt Nam của máy chủ, không kèm múi giờ
      plan: { name: 'Pro', tier: 'PRO', status: 'ACTIVE', expiresAt: '2026-10-17T09:00:00+07:00' },
      userCount: 2,
      hasAdmin: true,
    },
    {
      company: expect.objectContaining({ id: '2', code: 'FAST-MOVE', status: 'SUSPENDED' }),
      plan: null,
      userCount: 0,
      hasAdmin: false,
    },
  ])
  expect(list).toMatchObject({ plansLoaded: true, usersLoaded: true, takenEmails: ['qtcongty@loadmaster.vn', 'taixe@loadmaster.vn', 'quantri@loadmaster.vn'] })
  expect(new Set(calls.map((call) => call.url))).toStrictEqual(new Set([
    'http://be.test/api/companies?sort=id%2Casc&page=0&size=200',
    'http://be.test/api/companies?sort=id%2Casc&page=1&size=200',
    'http://be.test/api/contracts',
    'http://be.test/api/users?page=0&size=500',
  ]))
})

test('danh sách: gói hay người dùng không đọc được thì vẫn có công ty, cờ nói phần nào thiếu', async () => {
  serve({
    'GET /api/companies?sort=id%2Casc&page=0&size=200': springPage([LONG_BINH, { ...LONG_BINH, id: 3, status: 'ARCHIVED' }], true, 0),
    'GET /api/contracts': failure(403),
    'GET /api/users?page=0&size=500': failure(500),
  })
  const list = await listServerCompanies()
  expect(list).toMatchObject({ plansLoaded: false, usersLoaded: false, takenEmails: [] })
  expect(list.rows[0]).toMatchObject({ plan: null, userCount: null, hasAdmin: null })
  // Trạng thái FE chưa biết không bị đoán thành "đang hoạt động"
  expect(list.rows[1]?.company.status).toBeNull()
})

test('danh sách: không đọc được công ty thì cả màn báo lỗi', async () => {
  serve({ 'GET /api/companies?sort=id%2Casc&page=0&size=200': failure(403), 'GET /api/contracts': [], 'GET /api/users?page=0&size=500': usersPage })
  await expect(listServerCompanies()).rejects.toMatchObject({ name: 'ApiError', code: 'UNAUTHORIZED', status: 403 })
})

const NEW_COMPANY = { code: 'QA-01', name: 'QA Vận tải', taxCode: 'QA-TAX-01', billingEmail: 'qa@vantai.vn' }
const ADMIN = { fullName: 'QA Quản trị', email: 'qa.admin@vantai.vn', phone: '0901 234 567' }
const CREATED = { ...LONG_BINH, id: 9, companyCode: 'QA-01', companyName: 'QA Vận tải', taxCode: 'QA-TAX-01', billingEmail: 'qa@vantai.vn' }

test('tạo: tạo công ty rồi tạo quản trị công ty của đúng công ty đó; mật khẩu tạm trả về một lần', async () => {
  serve({
    'POST /api/companies': CREATED,
    'POST /api/users': { success: true, data: { user: { ...USER, id: 20, email: ADMIN.email, fullName: ADMIN.fullName, companyId: 9 }, temporaryPassword: 'Tmp#QA001' } },
  })
  const result = await createServerCompany(NEW_COMPANY, ADMIN)
  expect(calls.map(({ method, url, body }) => [method, url, body])).toStrictEqual([
    ['POST', 'http://be.test/api/companies', { companyCode: 'QA-01', companyName: 'QA Vận tải', taxCode: 'QA-TAX-01', billingEmail: 'qa@vantai.vn' }],
    ['POST', 'http://be.test/api/users', { email: ADMIN.email, fullName: ADMIN.fullName, phoneNumber: '0901234567', role: 'ADMIN', companyId: 9 }],
  ])
  expect(result).toStrictEqual({
    company: expect.objectContaining({ id: '9', code: 'QA-01' }),
    admin: { user: expect.objectContaining({ id: '20', role: 'companyAdmin', companyId: '9', email: ADMIN.email }), temporaryPassword: 'Tmp#QA001' },
  })
})

test('tạo: công ty đã tạo mà tạo quản trị hỏng thì kết quả mang lỗi đó, không ném', async () => {
  serve({ 'POST /api/companies': CREATED, 'POST /api/users': failure(409) })
  const result = await createServerCompany(NEW_COMPANY, ADMIN)
  expect(result).toMatchObject({ company: { id: '9' }, adminError: { name: 'ApiError', code: 'EMAIL_ALREADY_EXISTS', status: 409 } })
})

test('tạo: 409 của công ty đọc lại danh sách để nói mã công ty hay mã số thuế bị trùng', async () => {
  serve({ 'POST /api/companies': failure(409), 'GET /api/companies?sort=id%2Casc&page=0&size=200': springPage([{ ...LONG_BINH, companyCode: 'QA-01' }], true, 0) })
  await expect(createServerCompany(NEW_COMPANY, ADMIN)).rejects.toMatchObject({ code: 'COMPANY_ALREADY_EXISTS', status: 409 })
  expect(calls.some((call) => call.url.endsWith('/api/users'))).toBe(false)

  serve({ 'POST /api/companies': failure(409), 'GET /api/companies?sort=id%2Casc&page=0&size=200': springPage([{ ...LONG_BINH, taxCode: 'QA-TAX-01' }], true, 0) })
  await expect(createServerCompany(NEW_COMPANY, ADMIN)).rejects.toMatchObject({ code: 'TAX_CODE_ALREADY_EXISTS' })

  // Đọc lại không thấy trùng (hoặc không đọc được): giữ lỗi chung
  serve({ 'POST /api/companies': failure(409), 'GET /api/companies?sort=id%2Casc&page=0&size=200': failure(500) })
  await expect(createServerCompany(NEW_COMPANY, ADMIN)).rejects.toMatchObject({ code: 'CONFLICT' })
})

test('tạo riêng quản trị cho công ty đã có', async () => {
  serve({ 'POST /api/users': { success: true, data: { user: { ...USER, id: 21, companyId: 2 }, temporaryPassword: 'Tmp#QA002' } } })
  const result = await createServerCompanyAdmin('2', ADMIN)
  expect(calls[0]?.body).toStrictEqual({ email: ADMIN.email, fullName: ADMIN.fullName, phoneNumber: '0901234567', role: 'ADMIN', companyId: 2 })
  expect(result.temporaryPassword).toBe('Tmp#QA002')
})

const CURRENT: ServerCompany = {
  id: '1', code: 'LM-LOGISTICS', name: 'Vận tải Long Bình', taxCode: 'TAX-LM-001', billingEmail: 'qtcongty@loadmaster.vn', status: 'ACTIVE', createdAt: null,
}

test('sửa: gửi lại mã công ty, không gửi trạng thái; 409 là mã số thuế trùng', async () => {
  serve({ 'PUT /api/companies/1': { ...LONG_BINH, companyName: 'QA Long Bình mới' } })
  const updated = await updateServerCompany(CURRENT, { name: 'QA Long Bình mới', taxCode: 'TAX-LM-001', billingEmail: 'ketoan@longbinh.vn' })
  expect(calls[0]).toMatchObject({
    method: 'PUT',
    url: 'http://be.test/api/companies/1',
    body: { companyCode: 'LM-LOGISTICS', companyName: 'QA Long Bình mới', taxCode: 'TAX-LM-001', billingEmail: 'ketoan@longbinh.vn' },
  })
  expect(updated.name).toBe('QA Long Bình mới')

  serve({ 'PUT /api/companies/1': failure(409) })
  await expect(updateServerCompany(CURRENT, { name: 'A', taxCode: 'TAX-FM-001', billingEmail: 'a@b.vn' })).rejects.toMatchObject({ code: 'TAX_CODE_ALREADY_EXISTS' })
})

test('tạm ngưng, mở lại: trạng thái đi trong tham số, không có thân', async () => {
  serve({ 'PATCH /api/companies/2/status?status=SUSPENDED': PHUONG_NAM, 'PATCH /api/companies/2/status?status=ACTIVE': { ...PHUONG_NAM, status: 'ACTIVE' } })
  expect((await setServerCompanyStatus('2', 'SUSPENDED')).status).toBe('SUSPENDED')
  expect((await setServerCompanyStatus('2', 'ACTIVE')).status).toBe('ACTIVE')
  expect(calls.map(({ method, url, body, contentType }) => [method, url, body, contentType])).toStrictEqual([
    ['PATCH', 'http://be.test/api/companies/2/status?status=SUSPENDED', undefined, undefined],
    ['PATCH', 'http://be.test/api/companies/2/status?status=ACTIVE', undefined, undefined],
  ])
})
