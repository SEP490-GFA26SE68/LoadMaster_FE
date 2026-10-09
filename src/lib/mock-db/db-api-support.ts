import type { CreditBalance, CreditTransaction, CurrentSubscription, SubscriptionStatus } from './billing-model'
import type { Company } from './source-types'
import type { NewSupportTicket, SupportTicket, TicketStatus } from './support-model'

/** Khung bên cạnh màn hỗ trợ: gói, số dư và `SUPPORT_PANEL_TRANSACTIONS` giao dịch credit gần nhất của một công ty — chỉ đọc. */
export type SupportCompanyPanel = {
  company: Company
  current: CurrentSubscription | null
  planStatus: SubscriptionStatus | null
  credit: CreditBalance
  transactions: CreditTransaction[]
}

export const SUPPORT_PANEL_TRANSACTIONS = 20

/**
 * Yêu cầu hỗ trợ (FE-8-07, D-67). Cùng quy ước với `MockDb`. Người của công ty (`support.create`) chỉ thấy và trả lời yêu cầu **do mình
 * gửi** — yêu cầu của đồng nghiệp, của công ty khác đọc là `NOT_FOUND`; Hỗ trợ khách hàng (`support.handle`) thấy mọi yêu cầu. Vai trò
 * nền tảng khác bị từ chối `ROLE_NOT_ALLOWED`. Ghi cần phiên đăng nhập (`NOT_SIGNED_IN`): yêu cầu và lần trả lời mang người làm.
 */
export type SupportDb = {
  /** Yêu cầu phiên được thấy, hoạt động gần nhất trước. */
  listSupportTickets(): Promise<SupportTicket[]>
  getSupportTicket(id: string): Promise<SupportTicket>
  /** Người của công ty gửi yêu cầu: trạng thái `OPEN`, thuộc công ty và người gửi của phiên. Sai dữ liệu: `TICKET_INVALID`. */
  createSupportTicket(input: NewSupportTicket): Promise<SupportTicket>
  /**
   * Thêm một trả lời (người gửi hoặc Hỗ trợ khách hàng). Yêu cầu đã đóng: `TICKET_CLOSED`. Hỗ trợ khách hàng trả lời yêu cầu `OPEN`
   * thì yêu cầu sang `IN_PROGRESS`. Ghi `ticket.replied` mang người gửi — chuông của người gửi.
   */
  replyToSupportTicket(ticketId: string, text: string): Promise<SupportTicket>
  /** Hỗ trợ khách hàng đổi trạng thái, kể cả mở lại yêu cầu đã đóng. Đúng trạng thái đang có thì không ghi gì. */
  setSupportTicketStatus(ticketId: string, status: TicketStatus): Promise<SupportTicket>
  /** Hỗ trợ khách hàng đọc gói, số dư và giao dịch credit gần nhất của một công ty. */
  getSupportCompanyPanel(companyId: string): Promise<SupportCompanyPanel>
}
