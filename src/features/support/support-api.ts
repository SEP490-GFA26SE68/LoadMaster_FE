/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Nhóm `support` nối backend thì gọi backend, không thì gọi kho mẫu:
 *   listSupportTickets      → GET /api/support-tickets (+ GET /api/users/me để giữ yêu cầu của chính mình)
 *   createSupportTicket     → POST /api/support-tickets
 *   setSupportTicketStatus  → PATCH /api/support-tickets/{id}
 *   chưa có ở BE (Q-18): replyToSupportTicket, getSupportCompanyPanel
 */

import { fetchBackendMe } from '@/features/auth/me-api'
import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import {
  BACKEND_TICKET_STATUSES,
  getMockDb,
  TICKET_STATUSES,
  type NewSupportTicket,
  type SupportCompanyPanel,
  type SupportTicket,
  type TicketStatus,
} from '@/lib/mock-db'
import { isPlatformRole } from '@/types/user'
import { ticketCreateBody, ticketOf, type SupportTicketDto } from './support-dto'

const ON_BACKEND = usesBackend('support')

/**
 * Việc màn làm được theo nguồn dữ liệu. Backend chưa có trao đổi (`replies`), chưa có khung công ty cho Hỗ trợ khách hàng
 * (`companyPanel`), không có mốc hoạt động gần nhất (`activityTime`); tên công ty đi kèm yêu cầu thay cho danh bạ công ty của kho mẫu
 * (`companyDirectory`); có thêm trạng thái Đã giải quyết (`statuses`).
 */
export const SUPPORT_SOURCE: {
  readonly replies: boolean
  readonly companyPanel: boolean
  readonly activityTime: boolean
  readonly companyDirectory: boolean
  readonly statuses: readonly TicketStatus[]
} = {
  replies: !ON_BACKEND,
  companyPanel: !ON_BACKEND,
  activityTime: !ON_BACKEND,
  companyDirectory: !ON_BACKEND,
  statuses: ON_BACKEND ? BACKEND_TICKET_STATUSES : TICKET_STATUSES,
}

function requiredTicketOf(dto: SupportTicketDto): SupportTicket {
  const ticket = ticketOf(dto)
  if (ticket === null) throw new ApiError('SERVER_ERROR')
  return ticket
}

/**
 * Yêu cầu hỗ trợ phiên được thấy, mới nhất trước: người của công ty chỉ thấy yêu cầu do mình gửi, Hỗ trợ khách hàng thấy mọi yêu cầu
 * (vai trò nền tảng khác: `ROLE_NOT_ALLOWED`). Backend trả **mọi yêu cầu của công ty** cho người của công ty, nên ở đây chỉ giữ yêu cầu
 * do chính người xem gửi — lọc ở trình duyệt, backend chưa chặn (người của công ty gọi thẳng API vẫn đọc được yêu cầu của đồng nghiệp).
 */
// GET /api/support-tickets
export async function listSupportTickets(): Promise<SupportTicket[]> {
  if (!ON_BACKEND) return getMockDb().listSupportTickets()
  const [tickets, me] = await Promise.all([api().get<SupportTicketDto[]>('/api/support-tickets'), fetchBackendMe()])
  const seesAll = me.role !== null && isPlatformRole(me.role)
  return tickets.filter((dto) => seesAll || String(dto.requesterId) === me.id).flatMap((dto) => ticketOf(dto) ?? [])
}

/** Người của công ty gửi yêu cầu kỹ thuật hoặc thanh toán; trạng thái Mở. Kho mẫu cấp mã `TKT-NNN`, backend cấp `TCK-…`. */
// POST /api/support-tickets
export async function createSupportTicket(input: NewSupportTicket): Promise<SupportTicket> {
  if (!ON_BACKEND) return getMockDb().createSupportTicket(input)
  return requiredTicketOf(await api().post<SupportTicketDto>('/api/support-tickets', { body: ticketCreateBody(input) }))
}

/** Người gửi hoặc Hỗ trợ khách hàng trả lời. Yêu cầu đã đóng: `TICKET_CLOSED`. Chỉ kho mẫu: màn nối backend không có ô trả lời. */
// chưa có ở BE (Q-18)
export function replyToSupportTicket(ticketId: string, text: string): Promise<SupportTicket> {
  if (ON_BACKEND) throw new Error('Backend chưa có trả lời yêu cầu hỗ trợ (Q-18)')
  return getMockDb().replyToSupportTicket(ticketId, text)
}

/** Hỗ trợ khách hàng đổi trạng thái, kể cả mở lại yêu cầu đã đóng. */
// PATCH /api/support-tickets/{id}
export async function setSupportTicketStatus(ticketId: string, status: TicketStatus): Promise<SupportTicket> {
  if (!ON_BACKEND) return getMockDb().setSupportTicketStatus(ticketId, status)
  return requiredTicketOf(await api().patch<SupportTicketDto>(`/api/support-tickets/${ticketId}`, { body: { status } }))
}

/** Gói, số dư và 20 giao dịch credit gần nhất của công ty — khung chỉ đọc bên cạnh màn hỗ trợ. Chỉ kho mẫu: màn nối backend không có khung. */
// chưa có ở BE (Q-18)
export function getSupportCompanyPanel(companyId: string): Promise<SupportCompanyPanel> {
  if (ON_BACKEND) throw new Error('Backend chưa có thông tin công ty cho Hỗ trợ khách hàng (Q-18)')
  return getMockDb().getSupportCompanyPanel(companyId)
}
