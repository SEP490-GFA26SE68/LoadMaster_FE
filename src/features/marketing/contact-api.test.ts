import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { sendGuestContact } from './contact-api'

/**
 * Form liên hệ công khai nối backend (`contacts`): khách chưa đăng nhập gửi `POST /api/contact-guests` không kèm token; backend trả DTO
 * trần (không phong bì), `createdAt` là `Instant` nhiều chữ số lẻ. `fetch` giả trả đúng dạng backend `develop` trả.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['contacts']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'contacts',
}))

type Call = { readonly method: string; readonly url: string; readonly body: unknown; readonly auth: string | null }

let calls: Call[] = []
let reply: Response | null = null

beforeEach(() => {
  calls = []
  connectApiAuth(() => Promise.resolve(null))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>
    calls.push({ method: init.method ?? 'GET', url: input, body: JSON.parse(String(init.body)), auth: headers.Authorization ?? null })
    return Promise.resolve(reply ?? new Response('null', { status: 500 }))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const SAVED = {
  id: 7, fullName: 'QA Khách', email: 'qa.khach@example.com', phoneNumber: '0900000001', companyName: 'QA Vận tải',
  interestedPlanId: 2, interestedPlanName: 'Pro', assignedToId: null, assignedToName: null, message: 'Cần báo giá',
  requestType: 'PRICING', status: 'NEW', note: null, createdAt: '2026-10-16T21:29:43.054948900Z', resolvedAt: null,
}

test('a guest sends every form field without a token; the bare reply becomes the request the form shows', async () => {
  reply = new Response(JSON.stringify(SAVED), { status: 201 })
  const contact = await sendGuestContact({
    fullName: 'QA Khách', email: 'qa.khach@example.com', phoneNumber: '0900000001', companyName: 'QA Vận tải',
    interestedPlanId: '2', message: 'Cần báo giá', requestType: 'PRICING',
  })
  expect(calls).toStrictEqual([{
    method: 'POST',
    url: 'http://be.test/api/contact-guests',
    auth: null,
    body: {
      fullName: 'QA Khách', email: 'qa.khach@example.com', phoneNumber: '0900000001', companyName: 'QA Vận tải',
      interestedPlanId: 2, message: 'Cần báo giá', requestType: 'PRICING',
    },
  }])
  expect(contact).toStrictEqual({
    id: '7', fullName: 'QA Khách', email: 'qa.khach@example.com', phoneNumber: '0900000001', companyName: 'QA Vận tải',
    interestedPlanId: '2', interestedPlanName: 'Pro', message: 'Cần báo giá', requestType: 'PRICING', status: 'NEW',
    createdAt: '2026-10-16T21:29:43.054Z',
  })
})

test('optional fields left empty go as null, and a plan id of the sample catalog is not sent (the backend reads it as bad JSON)', async () => {
  reply = new Response(JSON.stringify({ ...SAVED, phoneNumber: null, companyName: null, interestedPlanId: null, interestedPlanName: null, message: null }), { status: 201 })
  const contact = await sendGuestContact({ fullName: 'QA Khách', email: 'qa.khach@example.com', interestedPlanId: 'PLAN-002', requestType: 'INQUIRY' })
  expect(calls[0]?.body).toStrictEqual({
    fullName: 'QA Khách', email: 'qa.khach@example.com', phoneNumber: null, companyName: null, interestedPlanId: null, message: null,
    requestType: 'INQUIRY',
  })
  expect(contact).toStrictEqual({
    id: '7', fullName: 'QA Khách', email: 'qa.khach@example.com', requestType: 'PRICING', status: 'NEW', createdAt: '2026-10-16T21:29:43.054Z',
  })
})

test('a refusal of the backend arrives as a code the form can translate', async () => {
  reply = new Response(JSON.stringify({ success: false, message: 'Email không đúng định dạng' }), { status: 400 })
  const error = await sendGuestContact({ fullName: 'QA Khách', email: 'sai', requestType: 'OTHER' }).catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('BAD_REQUEST')
})
