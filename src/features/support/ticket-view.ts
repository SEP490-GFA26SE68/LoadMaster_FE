import type { SupportTicket } from '@/lib/mock-db'

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
