import { isPlatformRole, type User } from '@/types/user'
import { effectiveSubscriptionStatus, isUnlimited } from './billing-model'
import { SUPPORT_PANEL_TRANSACTIONS, type SupportDb } from './db-api-support'
import { nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { assertRole, sessionUser } from './session-role'
import {
  MAX_TICKET_TEXT,
  MAX_TICKET_TITLE,
  TICKET_KINDS,
  TICKET_STATUSES,
  type SupportTicket,
  type TicketKind,
  type TicketStatus,
} from './support-model'

const bad = (field: string) => new MockDbError('TICKET_INVALID', { field })

/** Chữ bắt buộc: đã bỏ khoảng trắng hai đầu, không trống, không quá `max`. */
function required(value: unknown, field: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '' || text.length > max) throw bad(field)
  return text
}

/**
 * Yêu cầu hỗ trợ (FE-8-07, D-67). Người của công ty chỉ thấy yêu cầu **do mình gửi**: `ctx.scope.supportTickets` lọc theo công ty, hàm
 * của kho lọc tiếp theo người gửi. Hỗ trợ khách hàng thấy hết; vai trò nền tảng khác bị từ chối. Kho không có phiên (test logic) đọc hết
 * và không ghi được — yêu cầu và lần trả lời phải mang người làm.
 */
export function supportMethods(ctx: DbContext): SupportDb {
  const { supportTickets } = ctx.state

  /** Người ghi: người của công ty hoặc Hỗ trợ khách hàng đang đăng nhập. */
  function writer(): User {
    const user = sessionUser(ctx)
    if (!user) throw new MockDbError('NOT_SIGNED_IN', {})
    if (user.role !== 'systemSupporter' && isPlatformRole(user.role)) throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
    return user
  }

  /** Người của công ty chỉ thấy yêu cầu của chính mình; kho không có phiên và Hỗ trợ khách hàng thấy hết. */
  function sees(ticket: SupportTicket): boolean {
    const user = sessionUser(ctx)
    return user === undefined || user.role === 'systemSupporter' || ticket.senderId === user.id
  }

  function assertReader() {
    const user = sessionUser(ctx)
    if (user !== undefined && user.role !== 'systemSupporter' && isPlatformRole(user.role)) throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
  }

  /** Yêu cầu để đọc: công ty khác hoặc của đồng nghiệp đều `NOT_FOUND`. */
  function readable(id: string): SupportTicket {
    assertReader()
    const ticket = ctx.scope.supportTickets.read(id)
    if (!sees(ticket)) throw new MockDbError('NOT_FOUND', { collection: 'supportTickets', id })
    return ticket
  }

  /** Yêu cầu để ghi: yêu cầu của công ty khác là `FORBIDDEN_COMPANY`, của đồng nghiệp `NOT_FOUND`. */
  function writable(id: string): SupportTicket {
    const ticket = ctx.scope.supportTickets.own(id)
    writer()
    if (!sees(ticket)) throw new MockDbError('NOT_FOUND', { collection: 'supportTickets', id })
    return ticket
  }

  const target = (id: string) => ({ type: 'ticket' as const, id })

  return {
    listSupportTickets: () =>
      ctx.respond(() => {
        assertReader()
        return ctx.scope.supportTickets.list().filter(sees)
          .toSorted((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? 1 : -1))
      }),

    getSupportTicket: (id) => ctx.respond(() => readable(id)),

    createSupportTicket: (input) =>
      ctx.respond(() => {
        const user = writer()
        if (user.role === 'systemSupporter') throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
        if (!TICKET_KINDS.includes(input.kind)) throw bad('kind')
        const title = required(input.title, 'title', MAX_TICKET_TITLE)
        const description = required(input.description, 'description', MAX_TICKET_TEXT)
        const at = ctx.nowIso()
        const ticket = put(supportTickets, {
          id: nextId('TKT', supportTickets.keys()), companyId: ctx.scope.newRecordCompany(), senderId: user.id, senderName: user.fullName,
          kind: input.kind as TicketKind, title, description, status: 'OPEN', replies: [], createdAt: at, updatedAt: at,
        })
        ctx.log('ticket.created', target(ticket.id), { ticketKind: ticket.kind }, ticket.companyId)
        return ticket
      }),

    replyToSupportTicket: (ticketId, text) =>
      ctx.respond(() => {
        const ticket = writable(ticketId)
        const user = writer()
        if (ticket.status === 'CLOSED') throw new MockDbError('TICKET_CLOSED', { ticketId })
        const reply = required(text, 'text', MAX_TICKET_TEXT)
        const at = ctx.nowIso()
        ticket.replies.push({ authorId: user.id, authorName: user.fullName, authorRole: user.role, text: reply, at })
        // Hỗ trợ khách hàng nhận việc: yêu cầu mới thành đang xử lý
        if (user.role === 'systemSupporter' && ticket.status === 'OPEN') ticket.status = 'IN_PROGRESS'
        ticket.updatedAt = at
        ctx.log('ticket.replied', target(ticketId), { requestedBy: ticket.senderId }, ticket.companyId)
        return ticket
      }),

    setSupportTicketStatus: (ticketId, status) =>
      ctx.respond(() => {
        const ticket = ctx.scope.supportTickets.own(ticketId)
        assertRole(ctx, 'systemSupporter')
        if (!TICKET_STATUSES.includes(status)) throw bad('status')
        if (ticket.status === status) return ticket
        ticket.status = status as TicketStatus
        ticket.updatedAt = ctx.nowIso()
        ctx.log('ticket.statusChanged', target(ticketId), { ticketStatus: status }, ticket.companyId)
        return ticket
      }),

    getSupportCompanyPanel: (companyId) =>
      ctx.respond(() => {
        const company = ctx.scope.companies.read(companyId)
        assertRole(ctx, 'systemSupporter')
        const subscription = ctx.scope.platformSubscriptions.list().find((item) => item.companyId === companyId)
        const current = subscription ? { subscription, plan: ctx.scope.plans.read(subscription.planId) } : null
        const planStatus = subscription ? effectiveSubscriptionStatus(subscription, ctx.nowIso()) : null
        const balance = ctx.scope.platformCreditAccounts.list().find((item) => item.companyId === companyId)?.balance ?? 0
        const transactions = ctx.scope.platformCreditTransactions.list().filter((item) => item.companyId === companyId)
          .toReversed().toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
          .slice(0, SUPPORT_PANEL_TRANSACTIONS)
        return {
          company,
          current,
          planStatus,
          credit: { balance, unlimited: current !== null && planStatus !== 'EXPIRED' && isUnlimited(current.plan) },
          transactions,
        }
      }),
  }
}
