import type { SupportTicket } from '@/lib/mock-db'
import type { Role } from '@/types/user'

/**
 * CHỈ ĐỂ HIỂN THỊ — không phải kiểm soát truy cập. Chọn yêu cầu nào được vẽ cho giống kho mẫu: Hỗ trợ khách hàng thấy mọi yêu cầu, mọi
 * người khác (kể cả hai vai trò nền tảng còn lại) chỉ thấy yêu cầu do chính mình gửi. Backend vẫn gửi về trình duyệt mọi yêu cầu của công
 * ty cho mọi người của công ty: dữ liệu của đồng nghiệp nằm sẵn trong phản hồi mạng, chặn thật là việc của backend.
 */
export function ticketsToDisplay(
  tickets: readonly SupportTicket[],
  viewer: { readonly id: string; readonly role: Role | null },
): SupportTicket[] {
  if (viewer.role === 'systemSupporter') return [...tickets]
  return tickets.filter((ticket) => ticket.senderId === viewer.id)
}

/** Mã người đọc thấy: mã backend cấp (`TCK-…`) khi có, không thì mã của kho mẫu (`TKT-NNN`). */
export function ticketLabel(ticket: SupportTicket): string {
  return ticket.code ?? ticket.id
}

/**
 * Công ty có yêu cầu, theo tên — bộ lọc và cột Công ty của `/ho-tro` khi tên công ty đi kèm yêu cầu (backend) thay cho danh bạ công ty
 * của kho mẫu. Yêu cầu không thuộc công ty nào (người gửi là tài khoản nền tảng) không thêm công ty.
 */
export function ticketCompanies(tickets: readonly SupportTicket[]): { id: string; name: string }[] {
  const names = new Map<string, string>()
  for (const ticket of tickets) {
    if (ticket.companyId !== '' && !names.has(ticket.companyId)) names.set(ticket.companyId, ticket.companyName ?? ticket.companyId)
  }
  return [...names].map(([id, name]) => ({ id, name })).toSorted((a, b) => a.name.localeCompare(b.name, 'vi'))
}
