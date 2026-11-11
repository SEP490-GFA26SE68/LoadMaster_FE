import { skipToken, useMutation, useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import type { NewSupportTicket, SupportTicket, TicketStatus } from '@/lib/mock-db'
import {
  SUPPORT_SOURCE,
  assignCompanyPlan,
  createSupportTicket,
  getSupportCompanyPanel,
  getSupportTicketThread,
  listCompanyContracts,
  listSupportTickets,
  replyToSupportTicket,
  setSupportTicketStatus,
  unlockTrialAccount,
} from './support-api'

/** Việc màn làm được theo nguồn dữ liệu (kho mẫu hay backend) — component đọc ở đây, không gọi `-api.ts`. */
export { SUPPORT_SOURCE } from './support-api'
export type { CompanyContract, SupportPanel, SupportPanelPlan } from './support-api'

/**
 * Hook Query của yêu cầu hỗ trợ (FE-8-07). Khoá `['support', 'tickets']`, `['support', 'panel', mã công ty]` và `['support', 'contracts']`,
 * `staleTime: 0` — yêu cầu đổi ở màn của người kia. Danh sách theo phiên của người đăng nhập; `AuthProvider` xoá cache khi đổi người.
 * Mọi lần ghi làm mới cả `['support']`, gói cước, nhật ký và chuông (người gửi nhận thông báo khi có trả lời).
 */
export function useSupportTicketsQuery() {
  return useQuery({ queryKey: ['support', 'tickets'], queryFn: listSupportTickets, staleTime: 0 })
}

function threadsOf(results: readonly UseQueryResult<SupportTicket>[]): ReadonlyMap<string, SupportTicket> {
  return new Map(results.flatMap((result) => (result.data === undefined ? [] : [[result.data.id, result.data] as const])))
}

/**
 * Trao đổi của các yêu cầu đang vẽ, khoá `['support', 'thread', mã]` (mọi lần ghi làm mới cùng `['support']`). Chỉ khi danh sách không mang
 * trao đổi (`SUPPORT_SOURCE.threads`, backend); kho mẫu không đọc gì và trả bảng rỗng. Ghép vào yêu cầu bằng `withThread`.
 */
export function useTicketThreadsQuery(ticketIds: readonly string[]): ReadonlyMap<string, SupportTicket> {
  return useQueries({
    queries: (SUPPORT_SOURCE.threads ? ticketIds : []).map((id) => ({
      queryKey: ['support', 'thread', id],
      queryFn: () => getSupportTicketThread(id),
      staleTime: 0,
    })),
    combine: threadsOf,
  })
}

/** Khung công ty của Hỗ trợ khách hàng; chưa chọn yêu cầu nào (`companyId` vắng) thì không đọc gì. */
export function useCompanyPanelQuery(companyId: string | undefined, companyName?: string) {
  return useQuery({
    queryKey: ['support', 'panel', companyId],
    queryFn: companyId === undefined ? skipToken : () => getSupportCompanyPanel(companyId, companyName),
    staleTime: 0,
  })
}

/** Hợp đồng gói của mọi công ty, cho hộp thoại đổi gói (chỉ khi `SUPPORT_SOURCE.planAssign`). */
export function useCompanyContractsQuery(enabled = true) {
  return useQuery({ queryKey: ['support', 'contracts'], queryFn: enabled ? listCompanyContracts : skipToken, staleTime: 0 })
}

function useRefreshSupport() {
  const client = useQueryClient()
  return () => Promise.all(['support', 'billing', 'companies', 'audit', 'notifications'].map((key) => client.invalidateQueries({ queryKey: [key] })))
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

export function useAssignCompanyPlanMutation() {
  const refresh = useRefreshSupport()
  return useMutation({
    mutationFn: ({ companyId, planId }: { companyId: string; planId: string }) => assignCompanyPlan(companyId, planId),
    onSuccess: refresh,
  })
}

export function useUnlockTrialMutation() {
  const refresh = useRefreshSupport()
  return useMutation({
    mutationFn: ({ ticketId, staffNote }: { ticketId: string; staffNote?: string }) => unlockTrialAccount(ticketId, staffNote),
    onSuccess: refresh,
  })
}
