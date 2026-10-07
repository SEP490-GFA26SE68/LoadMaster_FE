import type { Role } from '@/types/user'

/**
 * Yêu cầu hỗ trợ (FE-8-07, D-67; backend chưa có entity — Q-18): người của công ty gửi yêu cầu kỹ thuật hoặc thanh toán, Hỗ trợ khách
 * hàng trả lời và đổi trạng thái. Kiểu và hằng số thuần — kho ghi ở `db-support.ts`, seed ở `seed-support.ts`.
 */

export const TICKET_KINDS = ['TECHNICAL', 'BILLING'] as const
export type TicketKind = (typeof TICKET_KINDS)[number]

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

/** Giới hạn độ dài do kho kiểm (`TICKET_INVALID`): tiêu đề, và mô tả hoặc nội dung trả lời. */
export const MAX_TICKET_TITLE = 120
export const MAX_TICKET_TEXT = 2000

/** Một lần trả lời. Tên và vai trò chụp lúc trả lời: người của công ty không đọc được tài khoản nền tảng của Hỗ trợ. */
export type TicketReply = {
  authorId: string
  authorName: string
  authorRole: Role
  text: string
  /** ISO 8601 */
  at: string
}

export type SupportTicket = {
  /** `TKT-NNN`. */
  id: string
  companyId: string
  senderId: string
  /** Tên người gửi chụp lúc gửi, như `TicketReply.authorName`. */
  senderName: string
  kind: TicketKind
  title: string
  description: string
  status: TicketStatus
  replies: TicketReply[]
  /** ISO 8601 */
  createdAt: string
  /** Lần hoạt động gần nhất (gửi, trả lời, đổi trạng thái): danh sách xếp theo đây. */
  updatedAt: string
}

export type NewSupportTicket = Pick<SupportTicket, 'kind' | 'title' | 'description'>
