import { isoFromBackend } from '@/lib/backend-time'
import type { SupportTicket, TicketReply } from '@/lib/mock-db'
import { ROLES, type Role } from '@/types/user'

/**
 * Trao đổi của một yêu cầu hỗ trợ khi nối backend. Backend chưa có bảng trao đổi (Q-18): cả cuộc trao đổi là một mảng JSON ghi vào
 * `resolutionNote`, mốc giờ dạng `yyyy-MM-dd HH:mm:ss` theo giờ Việt Nam (như `LocalDateTime` của máy chủ), và chỉ giữ các lần trả lời
 * của **hai ngày có hoạt động gần nhất** để trường không phình mãi. Hàm ở đây thuần: đọc, ghi, cắt bớt.
 */
export const MAX_ACTIVE_CHAT_DAYS = 2

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000

/** Mốc ISO của app → `yyyy-MM-dd HH:mm:ss` giờ Việt Nam. */
export function chatTimestamp(iso: string): string {
  return new Date(Date.parse(iso) + VIETNAM_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ')
}

type StoredReply = { authorId: string; authorName: string; authorRole: string; text: string; at: string }

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
      return [{ authorId: item.authorId, authorName: item.authorName, authorRole, text: item.text, at: isoFromBackend(item.at) }]
    } catch {
      return []
    }
  })
}

/** Chỉ giữ các lần trả lời thuộc `maxDays` ngày (giờ Việt Nam) có hoạt động gần nhất, theo thứ tự thời gian. */
export function recentReplies<T extends { at: string }>(replies: readonly T[], maxDays = MAX_ACTIVE_CHAT_DAYS): T[] {
  const days = new Set([...new Set(replies.map((reply) => chatTimestamp(reply.at).slice(0, 10)))].toSorted().slice(-maxDays))
  return replies.filter((reply) => days.has(chatTimestamp(reply.at).slice(0, 10))).toSorted((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/** Trao đổi → nội dung `resolutionNote`. */
export function noteOfReplies(replies: readonly TicketReply[]): string {
  return JSON.stringify(recentReplies(replies).map((reply) => ({ ...reply, at: chatTimestamp(reply.at) })))
}

export type CompanyChatEntry = TicketReply & { readonly ticketId: string; readonly ticketLabel: string }

/** Mọi lần trả lời trong các yêu cầu của một công ty, của hai ngày có hoạt động gần nhất — khung lịch sử bên cạnh màn hỗ trợ. */
export function recentCompanyChat(tickets: readonly SupportTicket[], companyId: string, maxDays = MAX_ACTIVE_CHAT_DAYS): CompanyChatEntry[] {
  const entries = tickets
    .filter((ticket) => ticket.companyId === companyId)
    .flatMap((ticket) => ticket.replies.map((reply) => ({ ...reply, ticketId: ticket.id, ticketLabel: ticket.code ?? ticket.id })))
  return recentReplies(entries, maxDays)
}
