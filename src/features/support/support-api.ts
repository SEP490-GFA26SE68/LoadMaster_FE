/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Nhóm `support` nối backend thì gọi backend, không thì gọi kho mẫu:
 *   listSupportTickets       → GET /api/support-tickets (+ GET /api/users/me)
 *   createSupportTicket      → POST /api/support-tickets
 *   getSupportTicketThread   → GET /api/support-tickets/{id}/replies (chỉ backend; kho mẫu: danh sách đã mang trao đổi)
 *   replyToSupportTicket     → POST /api/support-tickets/{id}/replies
 *   setSupportTicketStatus   → PATCH /api/support-tickets/{id}
 *   unlockTrialAccount       → POST /api/support-tickets/{id}/unlock-trial (chỉ backend)
 */

import { fetchBackendMe } from '@/features/auth/me-api'
import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import {
  BACKEND_TICKET_STATUSES,
  getMockDb,
  TICKET_STATUSES,
  type NewSupportTicket,
  type SupportTicket,
  type TicketStatus,
} from '@/lib/mock-db'
import { ticketCreateBody, ticketOf, threadOf, type SupportTicketDto, type SupportTicketThreadDto } from './support-dto'
import { ticketsToDisplay } from './ticket-view'

const ON_BACKEND = usesBackend('support')

/**
 * Việc màn làm được theo nguồn dữ liệu. Backend: danh sách không mang trao đổi — màn đọc trao đổi của từng yêu cầu ở máy chủ (`threads`);
 * tên công ty đi kèm yêu cầu thay cho danh bạ công ty của kho mẫu (`companyDirectory`); có thêm trạng thái Đã giải quyết (`statuses`); Hỗ
 * trợ khách hàng mở khoá tài khoản dùng thử bị gắn cờ (`trialUnlock`, kho mẫu không có tài khoản dùng thử). Trao đổi và mốc hoạt động gần
 * nhất có ở cả hai nguồn.
 */
export const SUPPORT_SOURCE: {
  readonly replies: boolean
  readonly threads: boolean
  readonly activityTime: boolean
  readonly companyDirectory: boolean
  readonly trialUnlock: boolean
  readonly statuses: readonly TicketStatus[]
} = {
  replies: true,
  threads: ON_BACKEND,
  activityTime: true,
  companyDirectory: !ON_BACKEND,
  trialUnlock: ON_BACKEND,
  statuses: ON_BACKEND ? BACKEND_TICKET_STATUSES : TICKET_STATUSES,
}

function requiredTicketOf(dto: SupportTicketDto): SupportTicket {
  const ticket = ticketOf(dto)
  if (ticket === null) throw new ApiError('SERVER_ERROR')
  return ticket
}

/**
 * Yêu cầu hỗ trợ màn vẽ, mới nhất trước: Hỗ trợ khách hàng thấy mọi yêu cầu, người khác chỉ thấy yêu cầu do mình gửi. Kho mẫu chặn thật
 * (vai trò nền tảng khác: `ROLE_NOT_ALLOWED`); backend thì chưa — nó trả mọi yêu cầu của công ty cho mọi người của công ty — nên khi nối
 * backend ở đây chỉ chọn yêu cầu để vẽ (`ticketsToDisplay`): bộ lọc hiển thị, không phải lớp bảo mật.
 */
// GET /api/support-tickets
export async function listSupportTickets(): Promise<SupportTicket[]> {
  if (!ON_BACKEND) return getMockDb().listSupportTickets()
  const [dtos, viewer] = await Promise.all([api().get<SupportTicketDto[]>('/api/support-tickets'), fetchBackendMe()])
  return ticketsToDisplay(dtos.flatMap((dto) => ticketOf(dto) ?? []), viewer)
}

/** Người của công ty gửi yêu cầu kỹ thuật hoặc thanh toán; trạng thái Mở. Kho mẫu cấp mã `TKT-NNN`, backend cấp `TCK-…`. */
// POST /api/support-tickets
export async function createSupportTicket(input: NewSupportTicket): Promise<SupportTicket> {
  if (!ON_BACKEND) return getMockDb().createSupportTicket(input)
  return requiredTicketOf(await api().post<SupportTicketDto>('/api/support-tickets', { body: ticketCreateBody(input) }))
}

function requiredThreadOf(dto: SupportTicketThreadDto): SupportTicket {
  const ticket = threadOf(dto)
  if (ticket === null) throw new ApiError('SERVER_ERROR')
  return ticket
}

/**
 * Yêu cầu kèm cả trao đổi. Chỉ backend đọc riêng (danh sách của máy chủ không mang trao đổi); kho mẫu trả đúng yêu cầu trong danh sách.
 * Yêu cầu của người khác (người của công ty) hay không có: `SUPPORT_TICKET_NOT_FOUND`.
 */
// GET /api/support-tickets/{id}/replies
export async function getSupportTicketThread(ticketId: string): Promise<SupportTicket> {
  if (!ON_BACKEND) {
    const ticket = (await getMockDb().listSupportTickets()).find((item) => item.id === ticketId)
    if (ticket === undefined) throw new ApiError('NOT_FOUND')
    return ticket
  }
  return requiredThreadOf(await api().get<SupportTicketThreadDto>(`/api/support-tickets/${encodeURIComponent(ticketId)}/replies`))
}

/**
 * Người gửi hoặc Hỗ trợ khách hàng trả lời. Kho mẫu: yêu cầu đã đóng là `TICKET_CLOSED`. Backend ghi một dòng vào bảng trao đổi và trả cả
 * trao đổi; máy chủ đổi trạng thái như kho mẫu (nhân sự nền tảng trả lời yêu cầu Mở thì nhận xử lý) và từ chối yêu cầu đã đóng
 * (`SUPPORT_TICKET_CLOSED`) hay đang do người khác xử lý (`SUPPORT_TICKET_LOCKED`).
 */
// POST /api/support-tickets/{id}/replies
export async function replyToSupportTicket(ticketId: string, text: string): Promise<SupportTicket> {
  if (!ON_BACKEND) return getMockDb().replyToSupportTicket(ticketId, text)
  const body = { message: text.trim() }
  return requiredThreadOf(await api().post<SupportTicketThreadDto>(`/api/support-tickets/${encodeURIComponent(ticketId)}/replies`, { body }))
}

/** Hỗ trợ khách hàng đổi trạng thái, kể cả mở lại yêu cầu đã đóng. */
// PATCH /api/support-tickets/{id}
export async function setSupportTicketStatus(ticketId: string, status: TicketStatus): Promise<SupportTicket> {
  if (!ON_BACKEND) return getMockDb().setSupportTicketStatus(ticketId, status)
  return requiredTicketOf(await api().patch<SupportTicketDto>(`/api/support-tickets/${encodeURIComponent(ticketId)}`, { body: { status } }))
}

export type UnlockTrialResult = {
  userId: number
  userEmail: string
  trialStillValid: boolean
  nextAction: 'SIGN_AGREEMENT' | 'UPGRADE_PLAN'
  ticketCode: string
  ticketStatus: string
}

/** Mở khoá tài khoản dùng thử từ yêu cầu `TRIAL_ACCOUNT_UNLOCK` (`SUPPORT_SOURCE.trialUnlock`); kho mẫu từ chối `NOT_SUPPORTED`. */
// POST /api/support-tickets/{id}/unlock-trial
export async function unlockTrialAccount(ticketId: string, staffNote?: string): Promise<UnlockTrialResult> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  const query = staffNote && staffNote.trim() ? { staffNote: staffNote.trim() } : undefined
  return api().post<UnlockTrialResult>(`/api/support-tickets/${ticketId}/unlock-trial`, { query })
}
