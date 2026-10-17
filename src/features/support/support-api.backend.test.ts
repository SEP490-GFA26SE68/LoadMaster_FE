import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import { createSupportTicket, listSupportTickets, setSupportTicketStatus } from './support-api'

/**
 * Yêu cầu hỗ trợ khi nhóm `support` nối backend. `/api/support-tickets` trả phong bì `ApiResponse`; `createdAt` là `LocalDateTime`
 * không múi giờ (giờ Việt Nam của máy chủ). Backend trả mọi yêu cầu của công ty cho mọi người của công ty: lớp API chỉ chọn yêu cầu để vẽ
 * (bộ lọc hiển thị, không phải bảo mật) — Hỗ trợ khách hàng thấy mọi yêu cầu, người khác chỉ thấy yêu cầu do mình gửi (mã của người xem
 * đọc ở `/api/users/me`).
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['support']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'support',
}))

type Call = { readonly key: string; readonly body: unknown }
let calls: Call[] = []
let routes: Record<string, Response | (() => Response)> = {}

const envelope = (data: unknown, status = 200) => () => new Response(JSON.stringify({ success: true, message: 'ok', data }), { status })

beforeEach(() => {
  calls = []
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const key = `${init.method ?? 'GET'} ${input.replace('http://be.test', '')}`
    calls.push({ key, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
    const route = routes[key]
    return Promise.resolve(typeof route === 'function' ? route() : (route ?? new Response('{}', { status: 404 })))
  })
})

afterEach(() => vi.unstubAllGlobals())

const OWN = {
  id: 2, ticketCode: 'TCK-20261017-4403', subject: 'Ly thuỷ tinh dưới thùng nước', description: 'Kho phải xếp lại bằng tay.',
  category: 'ALGORITHM_ERROR', priority: 'HIGH', status: 'IN_PROGRESS', requesterId: 7, requesterName: 'Nguyễn Thanh Tùng',
  requesterEmail: 'dieuphoi@loadmaster.vn', companyId: 1, companyName: 'Vận tải Long Bình', assignedToId: 4, assignedToName: 'Tạ Thị Ngọc Ánh',
  resolutionNote: null, createdAt: '2026-10-16T18:05:00', resolvedAt: null,
}
const COLLEAGUE = { ...OWN, id: 1, ticketCode: 'TCK-20261017-2258', subject: 'Hoá đơn tháng 10', category: 'BILLING', status: 'OPEN', requesterId: 5 }

const meAs = (id: number, userRoleType: string) => envelope({ id, fullName: 'Người xem', userRoleType, status: 'ACTIVE' })

test('a company user is shown only the tickets they sent (display only: the backend still sends every ticket of the company)', async () => {
  routes = { 'GET /api/support-tickets': envelope([OWN, COLLEAGUE]), 'GET /api/users/me': meAs(7, 'DISPATCHER') }
  expect(await listSupportTickets()).toStrictEqual([{
    id: '2', code: 'TCK-20261017-4403', companyId: '1', companyName: 'Vận tải Long Bình', senderId: '7', senderName: 'Nguyễn Thanh Tùng',
    kind: 'TECHNICAL', title: 'Ly thuỷ tinh dưới thùng nước', description: 'Kho phải xếp lại bằng tay.', status: 'IN_PROGRESS',
    replies: [], createdAt: '2026-10-16T11:05:00.000Z', updatedAt: '2026-10-16T11:05:00.000Z',
  }])
})

test('a supporter keeps every ticket; Resolved and the note of the support team come through, an unknown status does not', async () => {
  routes = {
    'GET /api/support-tickets': envelope([
      { ...COLLEAGUE, status: 'RESOLVED', resolutionNote: 'Đã gửi lại hoá đơn có mã số thuế.' },
      OWN,
      { ...OWN, id: 9, status: 'ARCHIVED' },
    ]),
    'GET /api/users/me': meAs(4, 'SYSTEM_SUPPORTER'),
  }
  const tickets = await listSupportTickets()
  expect(tickets.map(({ id, kind, status, resolutionNote }) => ({ id, kind, status, resolutionNote }))).toStrictEqual([
    { id: '1', kind: 'BILLING', status: 'RESOLVED', resolutionNote: 'Đã gửi lại hoá đơn có mã số thuế.' },
    { id: '2', kind: 'TECHNICAL', status: 'IN_PROGRESS', resolutionNote: undefined },
  ])
})

test('only the support role is shown every ticket: the admin and the manager of the platform are shown none', async () => {
  routes = { 'GET /api/support-tickets': envelope([OWN, COLLEAGUE]), 'GET /api/users/me': meAs(1, 'SYSTEM_ADMIN') }
  expect(await listSupportTickets()).toStrictEqual([])
  routes = { ...routes, 'GET /api/users/me': meAs(3, 'SYSTEM_MANAGER') }
  expect(await listSupportTickets()).toStrictEqual([])
})

test('sending maps the two FE kinds to backend categories; a status change sends only the status', async () => {
  routes = {
    'POST /api/support-tickets': envelope({ ...OWN, id: 12, ticketCode: 'TCK-20261017-1234', subject: 'QA lỗi in nhãn', category: 'SYSTEM_BUG', status: 'OPEN' }, 201),
    'PATCH /api/support-tickets/12': envelope({ ...OWN, id: 12, category: 'SYSTEM_BUG', status: 'RESOLVED' }),
  }
  const sent = await createSupportTicket({ kind: 'TECHNICAL', title: 'QA lỗi in nhãn', description: 'Không in được.' })
  expect(sent).toMatchObject({ id: '12', code: 'TCK-20261017-1234', kind: 'TECHNICAL', status: 'OPEN' })
  await createSupportTicket({ kind: 'BILLING', title: 'QA hoá đơn', description: 'Thiếu mã số thuế.' })
  expect(await setSupportTicketStatus('12', 'RESOLVED')).toMatchObject({ id: '12', status: 'RESOLVED' })
  expect(calls.map(({ key, body }) => ({ key, body }))).toStrictEqual([
    { key: 'POST /api/support-tickets', body: { subject: 'QA lỗi in nhãn', description: 'Không in được.', category: 'SYSTEM_BUG' } },
    { key: 'POST /api/support-tickets', body: { subject: 'QA hoá đơn', description: 'Thiếu mã số thuế.', category: 'BILLING' } },
    { key: 'PATCH /api/support-tickets/12', body: { status: 'RESOLVED' } },
  ])
})

test('a role the backend does not let change a ticket gets a code the screen can translate', async () => {
  routes = { 'PATCH /api/support-tickets/2': () => new Response(JSON.stringify({ success: false, message: 'Bạn không có quyền' }), { status: 403 }) }
  const error = await setSupportTicketStatus('2', 'CLOSED').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('UNAUTHORIZED')
})
