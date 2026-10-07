import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NewSupportTicket, TicketStatus } from '@/lib/mock-db'
import {
  createSupportTicket,
  getSupportCompanyPanel,
  listSupportTickets,
  replyToSupportTicket,
  setSupportTicketStatus,
} from './support-api'

/**
 * Hook Query của yêu cầu hỗ trợ (FE-8-07). Khoá `['support', 'tickets']` và `['support', 'panel', mã công ty]`, `staleTime: 0` — yêu cầu
 * đổi ở màn của người kia. Danh sách theo phiên của người đăng nhập; `AuthProvider` xoá cache khi đổi người. Mọi lần ghi làm mới cả
 * `['support']`, nhật ký và chuông (người gửi nhận thông báo khi có trả lời).
 */
export function useSupportTicketsQuery() {
  return useQuery({ queryKey: ['support', 'tickets'], queryFn: listSupportTickets, staleTime: 0 })
}

/** Khung công ty của Hỗ trợ khách hàng; chưa chọn yêu cầu nào (`companyId` vắng) thì không đọc gì. */
export function useCompanyPanelQuery(companyId: string | undefined) {
  return useQuery({
    queryKey: ['support', 'panel', companyId],
    queryFn: companyId === undefined ? skipToken : () => getSupportCompanyPanel(companyId),
    staleTime: 0,
  })
}

function useRefreshSupport() {
  const client = useQueryClient()
  return () => Promise.all(['support', 'audit', 'notifications'].map((key) => client.invalidateQueries({ queryKey: [key] })))
}

export function useCreateTicketMutation() {
  const refresh = useRefreshSupport()
  return useMutation({ mutationFn: (input: NewSupportTicket) => createSupportTicket(input), onSuccess: refresh })
}

export function useReplyMutation() {
  const refresh = useRefreshSupport()
  return useMutation({ mutationFn: ({ ticketId, text }: { ticketId: string; text: string }) => replyToSupportTicket(ticketId, text), onSuccess: refresh })
}

export function useSetTicketStatusMutation() {
  const refresh = useRefreshSupport()
  return useMutation({ mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => setSupportTicketStatus(ticketId, status), onSuccess: refresh })
}
