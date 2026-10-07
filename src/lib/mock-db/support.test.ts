import { expect, test } from 'vitest'
import { createMockDb, type MockDb } from '@/lib/mock-db'

/**
 * Yêu cầu hỗ trợ (FE-8-07): người của công ty chỉ thấy và trả lời yêu cầu do mình gửi, Hỗ trợ khách hàng xử lý mọi yêu cầu. Cách ly giữa
 * hai công ty nằm ở `tenancy.test.ts`.
 */

const NOW = new Date('2026-09-14T03:00:00.000Z')
const DISPATCHER = 'US-0001'
const COLLEAGUE = 'US-0002'
const SUPPORT = 'US-NT-02'

function dbAs(userId: string): MockDb {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession(userId)
  return db
}

const INPUT = { kind: 'BILLING' as const, title: '  Hoá đơn tháng 9 ', description: 'Cần hoá đơn VAT của kỳ gia hạn gần nhất.' }

test('the seed has one open technical ticket and one closed billing ticket; each person of a company sees only the tickets they sent', async () => {
  const support = dbAs(SUPPORT)
  expect((await support.listSupportTickets()).map((ticket) => [ticket.id, ticket.companyId, ticket.kind, ticket.status, ticket.replies.length]))
    .toStrictEqual([['TKT-001', 'LOG-001', 'TECHNICAL', 'OPEN', 0], ['TKT-002', 'LOG-002', 'BILLING', 'CLOSED', 2]])
  expect((await dbAs(DISPATCHER).listSupportTickets()).map((ticket) => ticket.id)).toStrictEqual(['TKT-001'])
  const colleague = dbAs(COLLEAGUE)
  expect(await colleague.listSupportTickets()).toStrictEqual([])
  await expect(colleague.getSupportTicket('TKT-001')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(colleague.replyToSupportTicket('TKT-001', 'Em cũng bị')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

test('sending a ticket opens it for the sender and the company, trims the text and logs it', async () => {
  const db = dbAs(DISPATCHER)
  const ticket = await db.createSupportTicket(INPUT)
  expect(ticket).toStrictEqual({
    id: 'TKT-003', companyId: 'LOG-001', senderId: DISPATCHER, senderName: 'Nguyễn Thanh Tùng', kind: 'BILLING', title: 'Hoá đơn tháng 9',
    description: INPUT.description, status: 'OPEN', replies: [], createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
  })
  expect((await db.listEvents())[0]).toMatchObject({ action: 'ticket.created', actorId: DISPATCHER, companyId: 'LOG-001', target: { type: 'ticket', id: 'TKT-003' }, params: { ticketKind: 'BILLING' } })
})

test.each([
  ['kind', { kind: 'OTHER' }],
  ['title', { title: '   ' }],
  ['title', { title: 'x'.repeat(121) }],
  ['description', { description: '' }],
  ['description', { description: 'x'.repeat(2001) }],
])('a ticket with a bad %s is refused', async (field, change) => {
  const db = dbAs(DISPATCHER)
  await expect(db.createSupportTicket({ ...INPUT, ...change } as never)).rejects.toMatchObject({ code: 'TICKET_INVALID', params: { field } })
  expect((await db.listSupportTickets()).map((ticket) => ticket.id)).toStrictEqual(['TKT-001'])
})

test('a conversation: support replies (the ticket starts), the sender answers, support closes and reopens; the sender is told of each reply', async () => {
  const db = dbAs(SUPPORT)
  const started = await db.replyToSupportTicket('TKT-001', ' Bạn dùng Chrome bản nào? ')
  expect([started.status, started.replies.map((reply) => [reply.authorId, reply.authorName, reply.authorRole, reply.text])])
    .toStrictEqual(['IN_PROGRESS', [[SUPPORT, 'Tạ Thị Ngọc Ánh', 'systemSupporter', 'Bạn dùng Chrome bản nào?']]])
  // Chuông của người gửi: sự kiện thuộc công ty của yêu cầu và mang người gửi
  expect((await db.listEvents())[0]).toMatchObject({ action: 'ticket.replied', actorId: SUPPORT, companyId: 'LOG-001', params: { requestedBy: DISPATCHER } })

  db.restoreSession(DISPATCHER)
  const answered = await db.replyToSupportTicket('TKT-001', 'Chrome 129.')
  expect([answered.status, answered.replies.map((reply) => reply.authorId), answered.updatedAt]).toStrictEqual(['IN_PROGRESS', [SUPPORT, DISPATCHER], NOW.toISOString()])

  db.restoreSession(SUPPORT)
  expect((await db.setSupportTicketStatus('TKT-001', 'CLOSED')).status).toBe('CLOSED')
  expect((await db.listEvents())[0]).toMatchObject({ action: 'ticket.statusChanged', companyId: 'LOG-001', params: { ticketStatus: 'CLOSED' } })
  const events = (await db.listEvents()).length
  await db.setSupportTicketStatus('TKT-001', 'CLOSED')
  expect((await db.listEvents()).length).toBe(events)
  await expect(db.replyToSupportTicket('TKT-001', 'Thêm một ý')).rejects.toMatchObject({ code: 'TICKET_CLOSED', params: { ticketId: 'TKT-001' } })
  db.restoreSession(DISPATCHER)
  await expect(db.replyToSupportTicket('TKT-001', 'Em cần hỏi thêm')).rejects.toMatchObject({ code: 'TICKET_CLOSED' })
  db.restoreSession(SUPPORT)
  await db.setSupportTicketStatus('TKT-001', 'OPEN')
  expect((await db.replyToSupportTicket('TKT-001', 'Mở lại để trao đổi tiếp')).replies).toHaveLength(3)
  await expect(db.replyToSupportTicket('TKT-001', '   ')).rejects.toMatchObject({ code: 'TICKET_INVALID', params: { field: 'text' } })
})

test.each<[string, string, (db: MockDb) => Promise<unknown>, string]>([
  ['the system admin lists tickets', 'US-0005', (db) => db.listSupportTickets(), 'ROLE_NOT_ALLOWED'],
  ['the platform manager reads a ticket', 'US-NT-01', (db) => db.getSupportTicket('TKT-001'), 'ROLE_NOT_ALLOWED'],
  ['customer support sends a ticket', SUPPORT, (db) => db.createSupportTicket(INPUT), 'ROLE_NOT_ALLOWED'],
  ['a dispatcher changes a status', DISPATCHER, (db) => db.setSupportTicketStatus('TKT-001', 'CLOSED'), 'ROLE_NOT_ALLOWED'],
  ['a company admin reads the support panel of its own company', 'US-LB-01', (db) => db.getSupportCompanyPanel('LOG-001'), 'ROLE_NOT_ALLOWED'],
])('%s: refused', async (_what, userId, call, code) => {
  await expect(call(dbAs(userId))).rejects.toMatchObject({ code })
})

test('without a session a ticket cannot be sent or answered: it needs an author', async () => {
  const db = createMockDb({ now: () => NOW })
  await expect(db.createSupportTicket(INPUT)).rejects.toMatchObject({ code: 'NOT_SIGNED_IN' })
  await expect(db.replyToSupportTicket('TKT-001', 'Xin chào')).rejects.toMatchObject({ code: 'NOT_SIGNED_IN' })
})

test('the support panel of a company: its plan, balance and at most the twenty latest credit transactions, newest first', async () => {
  const db = dbAs(SUPPORT)
  const longBinh = await db.getSupportCompanyPanel('LOG-001')
  expect([longBinh.company.id, longBinh.current?.plan.name, longBinh.planStatus, longBinh.credit]).toStrictEqual(['LOG-001', 'Pro', 'ACTIVE', { balance: 486, unlimited: false }])
  expect(longBinh.transactions).toHaveLength(17)
  expect(new Set(longBinh.transactions.map((item) => item.companyId))).toStrictEqual(new Set(['LOG-001']))
  expect(longBinh.transactions.map((item) => item.createdAt)).toStrictEqual(longBinh.transactions.map((item) => item.createdAt).toSorted().toReversed())
  const phuongNam = await db.getSupportCompanyPanel('LOG-002')
  expect([phuongNam.current?.plan.name, phuongNam.credit.balance, phuongNam.transactions.length]).toStrictEqual(['Basic', 2, 20])
  await expect(db.getSupportCompanyPanel('LOG-404')).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
