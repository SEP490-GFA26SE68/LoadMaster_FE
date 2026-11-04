import { isoFromBackend } from '@/lib/backend-time'
import { BACKEND_TICKET_STATUSES, type NewSupportTicket, type SupportTicket, type TicketKind } from '@/lib/mock-db'

/**
 * DTO của `/api/support-tickets` (entity `SupportTicket` của backend) và phép đổi sang kiểu của app. Chỉ `support-api.ts` dùng — kiểu DTO
 * không đi ra khỏi lớp API. Backend chưa có trao đổi: `replies` luôn rỗng, phản hồi của đội hỗ trợ là một trường `resolutionNote`.
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
  readonly resolutionNote: string | null
  /** `LocalDateTime` không múi giờ (giờ của máy chủ), khác `resolvedAt` là `Instant`. */
  readonly createdAt: string
}

function filled(value: string | null): value is string {
  return value !== null && value.trim() !== ''
}

/** Backend có ba nhóm (`BILLING`, `ALGORITHM_ERROR`, `SYSTEM_BUG`), FE hai loại: lỗi thuật toán và lỗi hệ thống đều là Kỹ thuật. */
function kindOf(category: string): TicketKind | undefined {
  if (category === 'BILLING') return 'BILLING'
  return category === 'SYSTEM_BUG' || category === 'ALGORITHM_ERROR' ? 'TECHNICAL' : undefined
}

const CATEGORY_OF_KIND: Readonly<Record<TicketKind, string>> = { BILLING: 'BILLING', TECHNICAL: 'SYSTEM_BUG' }

/**
 * Nhóm hay trạng thái backend mới mà FE chưa biết: không vào danh sách. Backend không có mốc hoạt động gần nhất nên `updatedAt` là lúc
 * gửi — màn nối backend hiện "Gửi lúc", không hiện "Cập nhật" (`SUPPORT_SOURCE.activityTime`).
 */
export function ticketOf(dto: SupportTicketDto): SupportTicket | null {
  const kind = kindOf(dto.category)
  const status = BACKEND_TICKET_STATUSES.find((item) => item === dto.status)
  if (kind === undefined || status === undefined) return null
  const createdAt = isoFromBackend(dto.createdAt)
  return {
    id: String(dto.id),
    ...(filled(dto.ticketCode) ? { code: dto.ticketCode } : {}),
    companyId: dto.companyId === null ? '' : String(dto.companyId),
    ...(filled(dto.companyName) ? { companyName: dto.companyName } : {}),
    senderId: dto.requesterId === null ? '' : String(dto.requesterId),
    senderName: dto.requesterName ?? dto.requesterEmail ?? '',
    kind,
    title: dto.subject,
    description: dto.description ?? '',
    status,
    replies: [],
    ...(filled(dto.resolutionNote) ? { resolutionNote: dto.resolutionNote } : {}),
    createdAt,
    updatedAt: createdAt,
  }
}

/** Thân `POST`: không gửi mức ưu tiên — backend đặt Trung bình. */
export function ticketCreateBody(input: NewSupportTicket) {
  return { subject: input.title, description: input.description, category: CATEGORY_OF_KIND[input.kind] }
}
