import { roleOfBackend } from '@/features/auth/backend-user'
import { isoFromBackend } from '@/lib/backend-time'
import { BACKEND_TICKET_STATUSES, type NewSupportTicket, type SupportTicket, type TicketKind, type TicketReply } from '@/lib/mock-db'
import { ROLES, type Role } from '@/types/user'
import { repliesOfNote } from './support-chat'

/**
 * DTO của `/api/support-tickets` (entity `SupportTicket` của backend) và phép đổi sang kiểu của app. Chỉ `support-api.ts` dùng — kiểu DTO
 * không đi ra khỏi lớp API. Trao đổi nằm ở bảng của máy chủ (`/api/support-tickets/{id}/replies`); yêu cầu cũ còn mảng JSON trong
 * `resolutionNote` (bản trước) thì danh sách đọc tạm mảng đó (`support-chat.ts`) tới khi màn đọc trao đổi của máy chủ; trường là chữ
 * thường (đội hỗ trợ ghi tay) thì vẫn là ghi chú `resolutionNote`.
 */
export type SupportTicketDto = {
  readonly id: number
  readonly ticketCode: string | null
  readonly subject: string
  readonly description: string | null
  readonly category: string
  readonly status: string
  readonly requesterId: number | null
  readonly requesterName: string | null
  readonly requesterEmail: string | null
  readonly companyId: number | null
  readonly companyName: string | null
  readonly assignedToId?: number | null
  readonly assignedToName?: string | null
  readonly resolutionNote: string | null
  /** `LocalDateTime` không múi giờ (giờ của máy chủ), khác `resolvedAt` là `Instant`. */
  readonly createdAt: string
  /** Lần hoạt động gần nhất (gửi, trả lời, đổi trạng thái); máy chủ cũ không trả. */
  readonly updatedAt?: string | null
}

/**
 * Một lần trả lời ở bảng trao đổi. `authorRole` là mã vai trò của máy chủ (`DISPATCHER`…); lần trả lời chép từ mảng JSON cũ giữ đúng chữ
 * đã ghi (mã vai trò của FE) và không có `authorId`.
 */
export type TicketReplyDto = {
  readonly id: number | null
  readonly authorId: string | null
  readonly authorName: string | null
  readonly authorRole: string | null
  readonly message: string
  /** `yyyy-MM-dd HH:mm:ss`, giờ Việt Nam. */
  readonly createdAt: string
}

/** `GET` / `POST /api/support-tickets/{id}/replies`: yêu cầu kèm cả trao đổi, theo thứ tự thời gian. */
export type SupportTicketThreadDto = {
  readonly ticket: SupportTicketDto
  readonly replies: readonly TicketReplyDto[] | null
}

function filled(value: string | null): value is string {
  return value !== null && value.trim() !== ''
}

/** Backend có các nhóm (`BILLING`, `ALGORITHM_ERROR`, `SYSTEM_BUG`, `TRIAL_ACCOUNT_UNLOCK`). */
function kindOf(category: string): TicketKind | undefined {
  if (category === 'BILLING') return 'BILLING'
  if (category === 'TRIAL_ACCOUNT_UNLOCK') return 'TRIAL_ACCOUNT_UNLOCK'
  return category === 'SYSTEM_BUG' || category === 'ALGORITHM_ERROR' ? 'TECHNICAL' : undefined
}

const CATEGORY_OF_KIND: Readonly<Record<TicketKind, string>> = {
  BILLING: 'BILLING',
  TECHNICAL: 'SYSTEM_BUG',
  TRIAL_ACCOUNT_UNLOCK: 'TRIAL_ACCOUNT_UNLOCK',
}

/**
 * Nhóm hay trạng thái backend mới mà FE chưa biết: không vào danh sách. `updatedAt` là mốc hoạt động gần nhất của máy chủ; máy chủ cũ không
 * trả thì là lần trả lời cuối của mảng cũ, không có thì lúc gửi.
 */
export function ticketOf(dto: SupportTicketDto): SupportTicket | null {
  const kind = kindOf(dto.category)
  const status = BACKEND_TICKET_STATUSES.find((item) => item === dto.status)
  if (kind === undefined || status === undefined) return null
  const createdAt = isoFromBackend(dto.createdAt)
  const replies = repliesOfNote(dto.resolutionNote)
  return {
    id: String(dto.id),
    ...(filled(dto.ticketCode) ? { code: dto.ticketCode } : {}),
    companyId: dto.companyId === null ? '' : String(dto.companyId),
    ...(filled(dto.companyName) ? { companyName: dto.companyName } : {}),
    senderId: dto.requesterId === null ? '' : String(dto.requesterId),
    senderName: dto.requesterName ?? dto.requesterEmail ?? '',
    ...(dto.status === 'IN_PROGRESS' && dto.assignedToId !== null && dto.assignedToId !== undefined ? { assignedToId: String(dto.assignedToId) } : {}),
    ...(dto.status === 'IN_PROGRESS' && filled(dto.assignedToName ?? null) ? { assignedToName: dto.assignedToName! } : {}),
    kind,
    title: dto.subject,
    description: dto.description ?? '',
    status,
    replies: replies ?? [],
    ...(replies === null && filled(dto.resolutionNote) ? { resolutionNote: dto.resolutionNote } : {}),
    createdAt,
    updatedAt: filled(dto.updatedAt ?? null) ? isoFromBackend(dto.updatedAt!) : (replies?.at(-1)?.at ?? createdAt),
  }
}

/** Vai trò người trả lời: mã của máy chủ, hoặc mã của FE với lần trả lời chép từ mảng cũ; vai trò lạ thì bỏ lần trả lời đó. */
function replyRoleOf(code: string | null): Role | null {
  if (code === null) return null
  return roleOfBackend(code) ?? ROLES.find((role) => role === code) ?? null
}

function replyOf(dto: TicketReplyDto): TicketReply | null {
  const authorRole = replyRoleOf(dto.authorRole)
  if (authorRole === null) return null
  return { authorId: dto.authorId ?? '', authorName: dto.authorName ?? '', authorRole, text: dto.message, at: isoFromBackend(dto.createdAt) }
}

/** Yêu cầu kèm trao đổi của máy chủ — thay mảng tạm đọc ở danh sách. */
export function threadOf(dto: SupportTicketThreadDto): SupportTicket | null {
  const ticket = ticketOf(dto.ticket)
  return ticket === null ? null : { ...ticket, replies: (dto.replies ?? []).flatMap((reply) => replyOf(reply) ?? []) }
}

/** Mức ưu tiên backend theo loại: thanh toán Trung bình, kỹ thuật và mở khóa tài khoản Cao. */
const PRIORITY_OF_KIND: Readonly<Record<TicketKind, string>> = {
  BILLING: 'MEDIUM',
  TECHNICAL: 'HIGH',
  TRIAL_ACCOUNT_UNLOCK: 'HIGH',
}

/** Thân `POST`. */
export function ticketCreateBody(input: NewSupportTicket) {
  return { subject: input.title, description: input.description, category: CATEGORY_OF_KIND[input.kind], priority: PRIORITY_OF_KIND[input.kind] }
}
