/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Backend chưa có entity, API yêu cầu hỗ trợ (Q-18):
 *   chưa có ở BE (Q-18): listSupportTickets, createSupportTicket, replyToSupportTicket, setSupportTicketStatus, getSupportCompanyPanel
 */

import { getMockDb, type NewSupportTicket, type SupportCompanyPanel, type SupportTicket, type TicketStatus } from '@/lib/mock-db'

/**
 * Yêu cầu hỗ trợ phiên được thấy, hoạt động gần nhất trước: người của công ty chỉ thấy yêu cầu do mình gửi, Hỗ trợ khách hàng thấy mọi
 * yêu cầu (vai trò nền tảng khác: `ROLE_NOT_ALLOWED`). Mỗi yêu cầu mang đủ các lần trả lời.
 */
// chưa có ở BE (Q-18)
export function listSupportTickets(): Promise<SupportTicket[]> {
  return getMockDb().listSupportTickets()
}

/** Người của công ty gửi yêu cầu kỹ thuật hoặc thanh toán; kho cấp mã `TKT-NNN`, trạng thái Mở. Sai dữ liệu: `TICKET_INVALID`. */
// chưa có ở BE (Q-18)
export function createSupportTicket(input: NewSupportTicket): Promise<SupportTicket> {
  return getMockDb().createSupportTicket(input)
}

/** Người gửi hoặc Hỗ trợ khách hàng trả lời. Yêu cầu đã đóng: `TICKET_CLOSED`. */
// chưa có ở BE (Q-18)
export function replyToSupportTicket(ticketId: string, text: string): Promise<SupportTicket> {
  return getMockDb().replyToSupportTicket(ticketId, text)
}

/** Hỗ trợ khách hàng đổi trạng thái, kể cả mở lại yêu cầu đã đóng. */
// chưa có ở BE (Q-18)
export function setSupportTicketStatus(ticketId: string, status: TicketStatus): Promise<SupportTicket> {
  return getMockDb().setSupportTicketStatus(ticketId, status)
}

/** Gói, số dư và 20 giao dịch credit gần nhất của công ty — khung chỉ đọc bên cạnh màn hỗ trợ. */
// chưa có ở BE (Q-18)
export function getSupportCompanyPanel(companyId: string): Promise<SupportCompanyPanel> {
  return getMockDb().getSupportCompanyPanel(companyId)
}
