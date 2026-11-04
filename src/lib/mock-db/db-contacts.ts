import type { User } from '@/types/user'
import {
  CONTACT_HANDLER_ROLES,
  CONTACT_LIMITS,
  CONTACT_REQUEST_TYPES,
  CONTACT_STATUSES,
  isContactEmail,
  type ContactField,
  type ContactRequestType,
  type ContactStatus,
  type GuestContact,
} from './contact-model'
import type { ContactsDb } from './db-api-contacts'
import { nextId, put, type DbContext } from './db-context'
import { MockDbError } from './errors'
import { assertRole } from './session-role'

const bad = (field: ContactField) => new MockDbError('CONTACT_INVALID', { field })

/** Chữ bắt buộc: bỏ khoảng trắng hai đầu, không trống, không quá `max`. */
function required(value: unknown, field: ContactField, max: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '' || text.length > max) throw bad(field)
  return text
}

/** Chữ tuỳ chọn: trống thì vắng, quá `max` là lỗi. */
function optional(value: unknown, field: ContactField, max: number): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw bad(field)
  const text = value.trim()
  if (text.length > max) throw bad(field)
  return text === '' ? undefined : text
}

const isHandler = (user: User) => user.status === 'active' && (CONTACT_HANDLER_ROLES as readonly string[]).includes(user.role)

/**
 * Yêu cầu liên hệ của khách (`ContactOfGuest`). Gửi không cần phiên và không đi qua phạm vi công ty — form công khai. Đọc và sửa đi qua
 * `ctx.scope.guestContacts` (phiên của một công ty: `ROLE_NOT_ALLOWED`) rồi chỉ ba vai trò nền tảng. Sự kiện nhật ký không thuộc công ty
 * nào (`null`): chỉ quản trị hệ thống đọc được trong nhật ký.
 */
export function contactMethods(ctx: DbContext): ContactsDb {
  const { guestContacts } = ctx.state
  const target = (id: string) => ({ type: 'contact' as const, id })

  /** Một yêu cầu cho ba vai trò xử lý; phiên của một công ty bị phạm vi từ chối trước. */
  function handled(id: string): GuestContact {
    const contact = ctx.scope.guestContacts.read(id)
    assertRole(ctx, ...CONTACT_HANDLER_ROLES)
    return contact
  }

  return {
    createGuestContact: (input) =>
      ctx.respond(() => {
        const fullName = required(input.fullName, 'fullName', CONTACT_LIMITS.fullName)
        const email = required(input.email, 'email', CONTACT_LIMITS.email)
        // Cùng luật với form công khai: email có `?`, `&`… (chèn tham số vào `mailto:`) không vào được kho
        if (!isContactEmail(email)) throw bad('email')
        if (!CONTACT_REQUEST_TYPES.includes(input.requestType)) throw bad('requestType')
        const phoneNumber = optional(input.phoneNumber, 'phoneNumber', CONTACT_LIMITS.phoneNumber)
        const companyName = optional(input.companyName, 'companyName', CONTACT_LIMITS.companyName)
        const message = optional(input.message, 'message', CONTACT_LIMITS.message)
        const interestedPlanId = optional(input.interestedPlanId, 'interestedPlanId', 40)
        if (interestedPlanId !== undefined && !ctx.scope.plans.list().some((plan) => plan.id === interestedPlanId)) throw bad('interestedPlanId')
        const contact = put(guestContacts, {
          id: nextId('LH', guestContacts.keys()),
          fullName,
          email,
          ...(phoneNumber ? { phoneNumber } : {}),
          ...(companyName ? { companyName } : {}),
          ...(interestedPlanId ? { interestedPlanId } : {}),
          ...(message ? { message } : {}),
          requestType: input.requestType as ContactRequestType,
          status: 'NEW',
          createdAt: ctx.nowIso(),
        })
        ctx.log('contact.received', target(contact.id), { fullName, contactType: contact.requestType }, null)
        return contact
      }),

    listGuestContacts: () =>
      ctx.respond(() => {
        const contacts = ctx.scope.guestContacts.list()
        assertRole(ctx, ...CONTACT_HANDLER_ROLES)
        return contacts.toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1))
      }),

    getGuestContact: (id) => ctx.respond(() => handled(id)),

    updateGuestContact: (id, patch) =>
      ctx.respond(() => {
        const contact = handled(id)
        const fields: string[] = []
        if (patch.status !== undefined) {
          if (!CONTACT_STATUSES.includes(patch.status)) throw bad('status')
          if (patch.status !== contact.status) fields.push('status')
        }
        let assignee: User | null | undefined
        if (patch.assignedToId !== undefined) {
          if (patch.assignedToId === null) assignee = null
          else {
            assignee = ctx.scope.users.list().find((user) => user.id === patch.assignedToId)
            if (assignee === undefined || !isHandler(assignee)) throw bad('assignedToId')
          }
          if ((assignee?.id ?? undefined) !== contact.assignedToId) fields.push('assignedToId')
        }
        let note: string | undefined
        if (patch.note !== undefined) {
          note = optional(patch.note, 'note', CONTACT_LIMITS.note)
          if (note !== contact.note) fields.push('note')
        }
        if (fields.length === 0) return contact

        const stored = guestContacts.get(id)!
        if (fields.includes('status')) {
          stored.status = patch.status as ContactStatus
          if ((stored.status === 'RESOLVED' || stored.status === 'CLOSED') && stored.resolvedAt === undefined) stored.resolvedAt = ctx.nowIso()
        }
        if (fields.includes('assignedToId')) {
          if (assignee) {
            stored.assignedToId = assignee.id
            stored.assignedToName = assignee.fullName
          } else {
            delete stored.assignedToId
            delete stored.assignedToName
          }
        }
        if (fields.includes('note')) {
          if (note === undefined) delete stored.note
          else stored.note = note
        }
        ctx.log('contact.updated', target(id), {
          fullName: stored.fullName,
          fields: fields.join(','),
          ...(fields.includes('status') ? { contactStatus: stored.status } : {}),
          ...(fields.includes('assignedToId') && stored.assignedToId ? { assignedTo: stored.assignedToId } : {}),
        }, null)
        return stored
      }),
  }
}
