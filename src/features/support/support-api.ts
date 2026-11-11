/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Nhóm `support` nối backend thì gọi backend, không thì gọi kho mẫu:
 *   listSupportTickets       → GET /api/support-tickets (+ GET /api/users/me)
 *   createSupportTicket      → POST /api/support-tickets
 *   replyToSupportTicket     → GET /api/support-tickets, rồi PATCH /api/support-tickets/{id} (trao đổi ghi trong `resolutionNote`, Q-18)
 *   setSupportTicketStatus   → PATCH /api/support-tickets/{id}
 *   getSupportCompanyPanel   → GET /api/contracts?companyId · GET /api/credits/balance?companyId · GET /api/credits/transactions?companyId
 *   listCompanyContracts     → GET /api/contracts (chỉ backend)
 *   assignCompanyPlan        → POST /api/contracts (chỉ backend)
 */

import { fetchBackendMe } from '@/features/auth/me-api'
import { api, ApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { usesBackend } from '@/lib/backend-config'
import {
  CREDIT_TRANSACTIONS_PATH,
  creditBalanceOf,
  creditTransactionOf,
  type CreditBalanceDto,
  type CreditTransactionDto,
} from '@/lib/billing-backend-api'
import {
  BACKEND_TICKET_STATUSES,
  getMockDb,
  SUPPORT_PANEL_TRANSACTIONS,
  TICKET_STATUSES,
  type NewSupportTicket,
  type SupportTicket,
  type TicketStatus,
} from '@/lib/mock-db'
import { isPlatformRole } from '@/types/user'
import { noteOfReplies } from './support-chat'
import { ticketCreateBody, ticketOf, type SupportTicketDto } from './support-dto'
import { contractOf, latestContracts, panelOfMock, type CompanyContract, type ContractDto, type SupportPanel } from './support-panel-dto'
import { ticketsToDisplay } from './ticket-view'

export type { CompanyContract, SupportPanel, SupportPanelPlan } from './support-panel-dto'

const ON_BACKEND = usesBackend('support')

/**
 * Việc màn làm được theo nguồn dữ liệu. Backend không có mốc hoạt động gần nhất (`activityTime`); tên công ty đi kèm yêu cầu thay cho
 * danh bạ công ty của kho mẫu (`companyDirectory`); có thêm trạng thái Đã giải quyết (`statuses`); Hỗ trợ khách hàng đổi gói cho công ty
 * khách ngay trên màn (`planAssign`, kho mẫu không có lệnh đó) và mở khoá tài khoản dùng thử bị gắn cờ (`trialUnlock`, kho mẫu không có
 * tài khoản dùng thử). Trao đổi và khung công ty có ở cả hai nguồn.
 */
export const SUPPORT_SOURCE: {
  readonly replies: boolean
  readonly companyPanel: boolean
  readonly activityTime: boolean
  readonly companyDirectory: boolean
  readonly planAssign: boolean
  readonly trialUnlock: boolean
  readonly statuses: readonly TicketStatus[]
} = {
  replies: true,
  companyPanel: true,
  activityTime: !ON_BACKEND,
  companyDirectory: !ON_BACKEND,
  planAssign: ON_BACKEND,
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

/**
 * Người gửi hoặc Hỗ trợ khách hàng trả lời. Kho mẫu: yêu cầu đã đóng là `TICKET_CLOSED`. Backend: đọc lại yêu cầu ngay trước khi ghi
 * (không ghi đè lần trả lời người kia vừa gửi), nối lần trả lời rồi ghi cả trao đổi vào `resolutionNote`; tài khoản nền tảng trả lời yêu
 * cầu Mở thì yêu cầu sang Đang xử lý, như kho mẫu.
 */
// GET /api/support-tickets, rồi PATCH /api/support-tickets/{id}
export async function replyToSupportTicket(ticketId: string, text: string): Promise<SupportTicket> {
  if (!ON_BACKEND) return getMockDb().replyToSupportTicket(ticketId, text)
  const [dtos, me] = await Promise.all([api().get<SupportTicketDto[]>('/api/support-tickets'), fetchBackendMe()])
  const dto = dtos.find((item) => String(item.id) === ticketId)
  const ticket = dto === undefined ? null : ticketOf(dto)
  if (ticket === null) throw new ApiError('NOT_FOUND')
  if (me.role === null) throw new ApiError('UNAUTHORIZED')
  const reply = { authorId: me.id, authorName: me.fullName, authorRole: me.role, text: text.trim(), at: new Date().toISOString() }
  const body = {
    ...(isPlatformRole(me.role) && ticket.status === 'OPEN' ? { status: 'IN_PROGRESS' } : {}),
    resolutionNote: noteOfReplies([...ticket.replies, reply]),
  }
  return requiredTicketOf(await api().patch<SupportTicketDto>(`/api/support-tickets/${encodeURIComponent(ticketId)}`, { body }))
}

/** Hỗ trợ khách hàng đổi trạng thái, kể cả mở lại yêu cầu đã đóng. */
// PATCH /api/support-tickets/{id}
export async function setSupportTicketStatus(ticketId: string, status: TicketStatus): Promise<SupportTicket> {
  if (!ON_BACKEND) return getMockDb().setSupportTicketStatus(ticketId, status)
  return requiredTicketOf(await api().patch<SupportTicketDto>(`/api/support-tickets/${encodeURIComponent(ticketId)}`, { body: { status } }))
}

async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise
  } catch {
    return null
  }
}

/**
 * Gói, số dư và 20 giao dịch credit gần nhất của công ty — khung bên cạnh màn hỗ trợ. Backend: tên công ty theo hợp đồng, không có hợp
 * đồng thì theo tên đi kèm yêu cầu (`companyName`); số dư, giao dịch đọc hỏng thì là `null`.
 */
// GET /api/contracts?companyId · GET /api/credits/balance?companyId · GET /api/credits/transactions?companyId
export async function getSupportCompanyPanel(companyId: string, companyName?: string): Promise<SupportPanel> {
  if (!ON_BACKEND) return panelOfMock(await getMockDb().getSupportCompanyPanel(companyId))
  const query = { companyId }
  const [contracts, balance, transactions] = await Promise.all([
    api().get<ContractDto[] | null>('/api/contracts', { query }),
    orNull(api().get<CreditBalanceDto>('/api/credits/balance', { query })),
    orNull(fetchAllPages<CreditTransactionDto>(CREDIT_TRANSACTIONS_PATH, { query, size: SUPPORT_PANEL_TRANSACTIONS, maxPages: 1 })),
  ])
  const dto = latestContracts((contracts ?? []).filter((item) => String(item.companyId) === companyId))[0]
  const contract = dto === undefined ? null : contractOf(dto, new Date().toISOString())
  return {
    companyName: contract?.companyName ?? companyName ?? companyId,
    plan: contract?.plan ?? null,
    planStatus: contract?.status ?? null,
    credit: balance === null ? null : creditBalanceOf(balance),
    transactions: transactions === null ? null : transactions.map(creditTransactionOf),
  }
}

/** Hợp đồng gói hiện tại của mọi công ty — hộp thoại đổi gói cho khách. Kho mẫu không có lệnh đổi gói nên không đọc gì. */
// GET /api/contracts
export async function listCompanyContracts(): Promise<CompanyContract[]> {
  if (!ON_BACKEND) return []
  const now = new Date().toISOString()
  return latestContracts((await api().get<ContractDto[] | null>('/api/contracts')) ?? []).map((dto) => contractOf(dto, now))
}

/** Hỗ trợ khách hàng áp ngay một gói cho công ty khách (tự gia hạn). Chỉ backend: kho mẫu đổi gói qua thanh toán của quản trị công ty. */
// POST /api/contracts
export async function assignCompanyPlan(companyId: string, planId: string): Promise<CompanyContract> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  const body = { companyId: Number(companyId), planId: Number(planId), autoRenew: true }
  return contractOf(await api().post<ContractDto>('/api/contracts', { body }), new Date().toISOString())
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
