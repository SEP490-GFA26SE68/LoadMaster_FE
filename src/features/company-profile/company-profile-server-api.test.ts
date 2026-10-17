import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { COMPANY_PROFILE_SOURCE, fetchCompanyProfile, saveCompanyProfile } from './company-profile-api'

/**
 * Thông tin công ty khi nối backend (`companies`): đúng endpoint, đúng thân, `CompanyResponse` trần (không phong bì) đổi sang
 * `ServerCompany`. Dạng phản hồi lấy từ backend chạy ở máy (17/10/2026).
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['companies']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'companies',
}))

type Call = { readonly method: string; readonly url: string; readonly body: unknown }

let calls: Call[] = []
let reply: () => Response

const LONG_BINH = {
  id: 1, companyCode: 'LM-LOGISTICS', companyName: 'Vận tải Long Bình', taxCode: 'TAX-LM-001', billingEmail: 'qtcongty@loadmaster.vn',
  status: 'ACTIVE', createdAt: '2026-10-16T21:05:16.181480Z',
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

beforeEach(() => {
  calls = []
  reply = () => json(LONG_BINH)
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    calls.push({ method: init.method ?? 'GET', url: input, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
    return Promise.resolve(reply())
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('reads the company of the token from GET /api/company/profile, a bare company response', async () => {
  expect(COMPANY_PROFILE_SOURCE).toBe('server')
  expect(await fetchCompanyProfile()).toStrictEqual({
    source: 'server',
    company: {
      id: '1', code: 'LM-LOGISTICS', name: 'Vận tải Long Bình', taxCode: 'TAX-LM-001', billingEmail: 'qtcongty@loadmaster.vn',
      status: 'ACTIVE', createdAt: '2026-10-16T21:05:16.181480Z',
    },
  })
  expect(calls).toStrictEqual([{ method: 'GET', url: 'http://be.test/api/company/profile', body: undefined }])
})

test('missing tax code or billing email read as empty text, a status the app does not know as no status', async () => {
  reply = () => json({ ...LONG_BINH, taxCode: null, billingEmail: null, status: 'ARCHIVED', createdAt: null })
  expect((await fetchCompanyProfile()).company).toMatchObject({ taxCode: '', billingEmail: '', status: null, createdAt: null })
})

test('saving sends only the two fields the server stores — name and billing email — and returns what the server saved', async () => {
  reply = () => json({ ...LONG_BINH, companyName: 'QA Vận tải Long Bình', billingEmail: 'ketoan@longbinh.vn' })
  const saved = await saveCompanyProfile({ source: 'server', name: 'QA Vận tải Long Bình', billingEmail: 'ketoan@longbinh.vn' })
  expect(calls).toStrictEqual([
    { method: 'PATCH', url: 'http://be.test/api/company/profile', body: { companyName: 'QA Vận tải Long Bình', contactEmail: 'ketoan@longbinh.vn' } },
  ])
  expect(saved).toMatchObject({ source: 'server', company: { name: 'QA Vận tải Long Bình', billingEmail: 'ketoan@longbinh.vn', code: 'LM-LOGISTICS' } })
})

test('a refusal of the server is an error with a code, not the server message', async () => {
  reply = () => json({ success: false, message: 'Access Denied' }, 403)
  await expect(fetchCompanyProfile()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 403 })
  reply = () => json({ success: false, message: 'Company not found' }, 404)
  await expect(saveCompanyProfile({ source: 'server', name: 'QA', billingEmail: 'qa@longbinh.vn' })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
})
