import { isoFromBackend } from '@/lib/backend-time'
import { MAX_SUPPORT_IMAGES, type SupportTicket, type TicketReply } from '@/lib/mock-db'
import { ROLES, type Role } from '@/types/user'

export { MAX_SUPPORT_IMAGES }

/**
 * Trao đổi của yêu cầu hỗ trợ. Máy chủ giữ trao đổi ở bảng riêng; yêu cầu cũ còn mảng JSON ghi trong `resolutionNote` (bản trước, mốc giờ
 * `yyyy-MM-dd HH:mm:ss` giờ Việt Nam) — ở đây chỉ còn đọc mảng đó, và khung trao đổi gần đây của công ty (hai ngày có hoạt động gần nhất).
 * Hàm thuần.
 */
export const MAX_ACTIVE_CHAT_DAYS = 2

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000

/** Mốc ISO của app → `yyyy-MM-dd HH:mm:ss` giờ Việt Nam. */
function chatTimestamp(iso: string): string {
  return new Date(Date.parse(iso) + VIETNAM_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ')
}

type StoredReply = { authorId: string; authorName: string; authorRole: string; text: string; at: string; images?: string[] }

function isStoredReply(value: unknown): value is StoredReply {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return ['authorId', 'authorName', 'authorRole', 'text', 'at'].every((key) => typeof item[key] === 'string')
}

function roleOf(value: string): Role | null {
  return ROLES.find((role) => role === value) ?? null
}

/** Trao đổi ghi trong `resolutionNote`; `null` khi trường không phải mảng trao đổi (ghi chú chữ thường của đội hỗ trợ). */
export function repliesOfNote(note: string | null): TicketReply[] | null {
  const text = note?.trim() ?? ''
  if (!text.startsWith('[')) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  return parsed.flatMap((item) => {
    if (!isStoredReply(item)) return []
    const authorRole = roleOf(item.authorRole)
    if (authorRole === null) return []
    try {
      return [{
        authorId: item.authorId,
        authorName: item.authorName,
        authorRole,
        text: item.text,
        at: isoFromBackend(item.at),
        ...(Array.isArray(item.images) && item.images.every((image) => typeof image === 'string') && item.images.length > 0 ? { images: item.images } : {}),
      }]
    } catch {
      return []
    }
  })
}

function noteItemsOf(note: string | null | undefined): unknown[] | null {
  const text = note?.trim() ?? ''
  if (!text.startsWith('[')) return null
  try {
    const parsed: unknown = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function imagesOf(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []
  const images = (value as Record<string, unknown>).images
  return Array.isArray(images) ? images.filter((image): image is string => typeof image === 'string') : []
}

/** Request attachments are separate note entries, not chat replies. */
export function requestAttachmentsOfNote(note: string | null): string[] {
  return (noteItemsOf(note) ?? []).flatMap((item) => {
    if (typeof item !== 'object' || item === null || (item as Record<string, unknown>).type !== 'requestAttachments') return []
    return imagesOf(item)
  })
}

/** A legacy plain note stays a visible support note after the note becomes chat JSON. */
export function supportNoteOfNote(note: string | null): string | undefined {
  const text = note?.trim() ?? ''
  if (!text) return undefined
  const items = noteItemsOf(text)
  if (items === null) return text
  const entry = items.find((item) => typeof item === 'object' && item !== null && (item as Record<string, unknown>).type === 'supportNote')
  if (typeof entry !== 'object' || entry === null) return undefined
  const message = (entry as Record<string, unknown>).text
  return typeof message === 'string' && message.trim() ? message : undefined
}

/** Merge legacy note replies with current table replies; migrated legacy rows may exist in both places. */
export function mergeReplies(noteReplies: readonly TicketReply[], tableReplies: readonly TicketReply[]): TicketReply[] {
  const unique = new Map<string, TicketReply>()
  for (const reply of [...noteReplies, ...tableReplies]) {
    const key = [reply.authorName, reply.authorRole, reply.text, Date.parse(reply.at)].join('\u0000')
    const previous = unique.get(key)
    if (previous === undefined || (!previous.images?.length && reply.images?.length)) unique.set(key, reply)
  }
  return [...unique.values()].toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/** Serialize the recent thread while retaining request attachments and an earlier plain support note. */
export function noteOfReplies(replies: readonly TicketReply[], existingNote?: string): string {
  const items = noteItemsOf(existingNote)
  const retained = items === null
    ? (existingNote?.trim() ? [{ type: 'supportNote', text: existingNote }] : [])
    : items.filter((item) => !isStoredReply(item))
  const messages = recentReplies(replies).map((reply) => ({ ...reply, at: chatTimestamp(reply.at) }))
  return JSON.stringify([...retained, ...messages])
}

/** Chỉ giữ các lần trả lời thuộc `maxDays` ngày (giờ Việt Nam) có hoạt động gần nhất, theo thứ tự thời gian. */
export function recentReplies<T extends { at: string }>(replies: readonly T[], maxDays = MAX_ACTIVE_CHAT_DAYS): T[] {
  const days = new Set([...new Set(replies.map((reply) => chatTimestamp(reply.at).slice(0, 10)))].toSorted().slice(-maxDays))
  return replies.filter((reply) => days.has(chatTimestamp(reply.at).slice(0, 10))).toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

export type CompanyChatEntry = TicketReply & { readonly ticketId: string; readonly ticketLabel: string }

/** Mọi lần trả lời trong các yêu cầu của một công ty, của hai ngày có hoạt động gần nhất — khung lịch sử bên cạnh màn hỗ trợ. */
export function recentCompanyChat(tickets: readonly SupportTicket[], companyId: string, maxDays = MAX_ACTIVE_CHAT_DAYS): CompanyChatEntry[] {
  const entries = tickets
    .filter((ticket) => ticket.companyId === companyId)
    .flatMap((ticket) => ticket.replies.map((reply) => ({ ...reply, ticketId: ticket.id, ticketLabel: ticket.code ?? ticket.id })))
  return recentReplies(entries, maxDays)
}
