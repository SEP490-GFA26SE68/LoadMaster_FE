import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth, isApiError } from '@/lib/api-client'
import {
  assignCompanyPlan,
  createSupportTicket,
  getSupportCompanyPanel,
  getSupportTicketThread,
  listSupportTickets,
  replyToSupportTicket,
  setSupportTicketStatus,
} from './support-api'

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
    assignedToId: '4', assignedToName: 'Tạ Thị Ngọc Ánh',
    kind: 'TECHNICAL', title: 'Ly thuỷ tinh dưới thùng nước', description: 'Kho phải xếp lại bằng tay.', status: 'IN_PROGRESS',
    replies: [], createdAt: '2026-10-16T11:05:00.000Z', updatedAt: '2026-10-16T11:05:00.000Z',
  }])
})

test('marks IN_PROGRESS ticket as lockedByOther when another supporter views it, but not for the assigned supporter or RESOLVED tickets', async () => {
  routes = {
    'GET /api/support-tickets': envelope([
      OWN,
      { ...COLLEAGUE, status: 'RESOLVED', assignedToId: 4, assignedToName: 'Tạ Thị Ngọc Ánh' },
    ]),
    'GET /api/users/me': meAs(9, 'SYSTEM_SUPPORTER'),
  }
  const forOtherSupporter = await listSupportTickets()
  expect(forOtherSupporter.map((t) => ({ id: t.id, status: t.status, lockedByOther: t.lockedByOther }))).toStrictEqual([
    { id: '2', status: 'IN_PROGRESS', lockedByOther: true },
    { id: '1', status: 'RESOLVED', lockedByOther: undefined },
  ])

  routes = { ...routes, 'GET /api/users/me': meAs(4, 'SYSTEM_SUPPORTER') }
  const forAssignedSupporter = await listSupportTickets()
  expect(forAssignedSupporter[0]?.lockedByOther).toBeUndefined()
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
    { key: 'POST /api/support-tickets', body: { subject: 'QA lỗi in nhãn', description: 'Không in được.', category: 'SYSTEM_BUG', priority: 'HIGH' } },
    { key: 'POST /api/support-tickets', body: { subject: 'QA hoá đơn', description: 'Thiếu mã số thuế.', category: 'BILLING', priority: 'MEDIUM' } },
    { key: 'PATCH /api/support-tickets/12', body: { status: 'RESOLVED' } },
  ])
})

test('a role the backend does not let change a ticket gets a code the screen can translate', async () => {
  routes = { 'PATCH /api/support-tickets/2': () => new Response(JSON.stringify({ success: false, message: 'Bạn không có quyền' }), { status: 403 }) }
  const error = await setSupportTicketStatus('2', 'CLOSED').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('UNAUTHORIZED')
})

/** Trao đổi của bản trước ghi trong `resolutionNote`: mảng JSON, giờ Việt Nam `yyyy-MM-dd HH:mm:ss`. */
const THREAD = JSON.stringify([
  { authorId: '7', authorName: 'Nguyễn Thanh Tùng', authorRole: 'dispatcher', text: 'Tin nhắn ngày 28/10', at: '2026-10-28 09:00:00' },
  { authorId: '4', authorName: 'Tạ Thị Ngọc Ánh', authorRole: 'systemSupporter', text: 'Tin nhắn ngày 29/10', at: '2026-10-29 14:30:00' },
])

test('a ticket from before the reply table still lists its old thread from resolutionNote; with no updatedAt the last reply is the latest activity', async () => {
  routes = { 'GET /api/support-tickets': envelope([{ ...OWN, resolutionNote: THREAD }]), 'GET /api/users/me': meAs(7, 'DISPATCHER') }
  const [ticket] = await listSupportTickets()
  expect(ticket?.resolutionNote).toBeUndefined()
  expect(ticket?.replies.map(({ text, at, authorRole }) => ({ text, at, authorRole }))).toStrictEqual([
    { text: 'Tin nhắn ngày 28/10', at: '2026-10-28T02:00:00.000Z', authorRole: 'dispatcher' },
    { text: 'Tin nhắn ngày 29/10', at: '2026-10-29T07:30:00.000Z', authorRole: 'systemSupporter' },
  ])
  expect(ticket?.updatedAt).toBe('2026-10-29T07:30:00.000Z')
})

test('the latest activity is the updatedAt of the server when it sends one', async () => {
  routes = { 'GET /api/support-tickets': envelope([{ ...OWN, resolutionNote: THREAD, updatedAt: '2026-10-30 08:00:00' }]), 'GET /api/users/me': meAs(7, 'DISPATCHER') }
  const [ticket] = await listSupportTickets()
  expect(ticket?.updatedAt).toBe('2026-10-30T01:00:00.000Z')
})

/** Trao đổi ở bảng của máy chủ: mã vai trò của máy chủ; lần trả lời chép từ mảng cũ giữ mã vai trò của FE và không có người. */
const SERVER_THREAD = [
  { id: null, authorId: null, authorName: 'Nguyễn Thanh Tùng', authorRole: 'dispatcher', message: 'Tin nhắn cũ', createdAt: '2026-10-28 09:00:00' },
  { id: 31, authorId: '4', authorName: 'Tạ Thị Ngọc Ánh', authorRole: 'SYSTEM_SUPPORTER', message: 'Đã nhận', createdAt: '2026-10-29 14:30:00' },
  { id: 32, authorId: '7', authorName: 'Nguyễn Thanh Tùng', authorRole: 'GUEST', message: 'Vai trò lạ', createdAt: '2026-10-29 15:00:00' },
]

test('the thread is read from the reply table of the server: server roles become app roles, a reply of an unknown role is left out', async () => {
  routes = { 'GET /api/support-tickets/2/replies': envelope({ ticket: { ...OWN, resolutionNote: THREAD, updatedAt: '2026-10-29 14:30:00' }, replies: SERVER_THREAD }) }
  const ticket = await getSupportTicketThread('2')
  expect(ticket.replies).toStrictEqual([
    { authorId: '', authorName: 'Nguyễn Thanh Tùng', authorRole: 'dispatcher', text: 'Tin nhắn cũ', at: '2026-10-28T02:00:00.000Z' },
    { authorId: '4', authorName: 'Tạ Thị Ngọc Ánh', authorRole: 'systemSupporter', text: 'Đã nhận', at: '2026-10-29T07:30:00.000Z' },
  ])
  expect(ticket.resolutionNote).toBeUndefined()
  expect(ticket.updatedAt).toBe('2026-10-29T07:30:00.000Z')
  expect(calls.map(({ key }) => key)).toStrictEqual(['GET /api/support-tickets/2/replies'])
})

test('a reply posts only its trimmed message to the reply table and reads back the whole thread with the status the server set', async () => {
  routes = {
    'POST /api/support-tickets/1/replies': envelope({
      ticket: { ...COLLEAGUE, status: 'IN_PROGRESS', assignedToId: 4, updatedAt: '2026-11-05 10:15:00' },
      replies: [{ id: 40, authorId: '4', authorName: 'Tạ Thị Ngọc Ánh', authorRole: 'SYSTEM_SUPPORTER', message: 'Đã nhận, đang kiểm tra.', createdAt: '2026-11-05 10:15:00' }],
    }),
  }
  const updated = await replyToSupportTicket('1', '  Đã nhận, đang kiểm tra.  ')
  expect(calls.map(({ key, body }) => ({ key, body }))).toStrictEqual([{ key: 'POST /api/support-tickets/1/replies', body: { message: 'Đã nhận, đang kiểm tra.' } }])
  expect(updated).toMatchObject({ id: '1', status: 'IN_PROGRESS', updatedAt: '2026-11-05T03:15:00.000Z' })
  expect(updated.replies.map(({ text, authorRole }) => ({ text, authorRole }))).toStrictEqual([{ text: 'Đã nhận, đang kiểm tra.', authorRole: 'systemSupporter' }])
})

test('a closed ticket refuses a reply with the code of the server', async () => {
  routes = {
    'POST /api/support-tickets/2/replies': () => new Response(JSON.stringify({ success: false, code: 'SUPPORT_TICKET_CLOSED', message: 'Phiếu đã đóng' }), { status: 409 }),
  }
  const error = await replyToSupportTicket('2', 'Còn ai không?').catch((caught: unknown) => caught)
  expect(isApiError(error) && error.code).toBe('SUPPORT_TICKET_CLOSED')
})

test('the company panel reads the contract, balance and transactions of that company; a balance that cannot be read is not shown as 0', async () => {
  routes = {
    'GET /api/contracts?companyId=1': envelope([
      { id: 2, companyId: 1, companyName: 'Vận tải Long Bình', planId: 2, planName: 'Pro', planTier: 'PRO', status: 'ACTIVE', startedAt: '2026-10-01T00:00:00', expiresAt: '2099-01-01T00:00:00', autoRenew: true },
    ]),
    'GET /api/credits/transactions?companyId=1&page=0&size=20': envelope({ content: [
      { id: 101, amount: 500, type: 'PURCHASE', reference: 'PAY-1', refunded: false, createdAt: '2026-10-19T10:00:00' },
    ], last: true }),
  }
  const panel = await getSupportCompanyPanel('1', 'Tên kèm yêu cầu')
  expect(panel).toStrictEqual({
    companyName: 'Vận tải Long Bình',
    plan: { id: '2', name: 'Pro', tier: 'PRO' },
    planStatus: 'ACTIVE',
    credit: null,
    transactions: [{ id: '101', companyId: '', type: 'PURCHASE', amount: 500, reference: 'PAY-1', refunded: false, createdAt: '2026-10-19T03:00:00.000Z' }],
  })
})

test('assigning a plan posts the contract and reads back what the backend applied', async () => {
  routes = {
    'POST /api/contracts': envelope({ id: 2, companyId: 1, companyName: 'Vận tải Long Bình', planId: 3, planName: 'Ultimate', planTier: 'ULTIMATE', status: 'ACTIVE', startedAt: null, expiresAt: null, autoRenew: true }),
  }
  expect(await assignCompanyPlan('1', '3')).toStrictEqual({
    companyId: '1', companyName: 'Vận tải Long Bình', plan: { id: '3', name: 'Ultimate', tier: 'ULTIMATE' }, status: 'ACTIVE',
  })
  expect(calls.map(({ key, body }) => ({ key, body }))).toStrictEqual([{ key: 'POST /api/contracts', body: { companyId: 1, planId: 3, autoRenew: true } }])
})
