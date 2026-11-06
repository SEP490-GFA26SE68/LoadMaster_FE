import type { Role } from '@/types/user'

/**
 * Yêu cầu hỗ trợ (FE-8-07, D-67; backend chưa có entity — Q-18): người của công ty gửi yêu cầu kỹ thuật hoặc thanh toán, Hỗ trợ khách
 * hàng trả lời và đổi trạng thái. Kiểu và hằng số thuần — kho ghi ở `db-support.ts`, seed ở `seed-support.ts`.
 */

export const TICKET_KINDS = ['TECHNICAL', 'BILLING'] as const
export type TicketKind = (typeof TICKET_KINDS)[number]

/** Trạng thái kho mẫu ghi được (`setSupportTicketStatus` từ chối trạng thái khác: `TICKET_INVALID`). */
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const

/** Trạng thái của backend (`TicketStatus`): thêm Đã giải quyết. Mọi trạng thái màn hiện được. */
export const BACKEND_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
export type TicketStatus = (typeof BACKEND_TICKET_STATUSES)[number]

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
  /** `TKT-NNN` ở kho mẫu; mã số ở backend. */
  id: string
  /** Mã backend cấp cho người đọc (`TCK-yyyyMMdd-NNNN`), màn hiện mã này thay `id`; kho mẫu không có. */
  code?: string
  companyId: string
  /** Tên công ty backend trả kèm yêu cầu; kho mẫu tra tên theo danh bạ công ty. */
  companyName?: string
  senderId: string
  /** Tên người gửi chụp lúc gửi, như `TicketReply.authorName`. */
  senderName: string
  kind: TicketKind
  title: string
  description: string
  status: TicketStatus
  replies: TicketReply[]
  /** Phản hồi của đội hỗ trợ ở backend (`resolutionNote`, một trường, không phải trao đổi); kho mẫu dùng `replies`. */
  resolutionNote?: string
  /** ISO 8601 */
  createdAt: string
  /** Lần hoạt động gần nhất (gửi, trả lời, đổi trạng thái): danh sách xếp theo đây. */
  updatedAt: string
}

export type NewSupportTicket = Pick<SupportTicket, 'kind' | 'title' | 'description'>
