import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { approveManualConfirmation, fetchManualConfirmations, rejectManualConfirmation } from './manual-confirm-api'
import { approveServerManualConfirmation, fetchServerManualConfirmations, rejectServerManualConfirmation } from './manual-confirm-backend-api'

/**
 * Hook Query cho thẻ "Xác nhận tay chờ duyệt" (FE-6-04). Khoá đọc nằm dưới `['trips', tripId]`: mọi ghi của chuyến làm mới nó. Duyệt
 * hoặc từ chối đổi dòng phụ của chuyến ở mọi màn và tiến độ kho / tài xế đang đọc, nên làm mới cả chuyến, danh sách kho, bảng điều
 * khiển và chuông. `server`: xác nhận tay của máy chủ (Chi tiết chuyến của máy chủ, `tripId` là mã số) thay vì kho mẫu.
 */
export function useManualConfirmationsQuery(tripId: string, server = false) {
  return useQuery({
    queryKey: ['trips', tripId, 'manual-confirms', server ? 'server' : 'store'],
    queryFn: () => (server ? fetchServerManualConfirmations(tripId) : fetchManualConfirmations(tripId)),
    enabled: tripId !== '',
    staleTime: 0,
  })
}

function refresh(client: QueryClient) {
  return Promise.all([['trips'], ['warehouse'], ['dashboard'], ['notifications']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

export function useApproveManualConfirmMutation(tripId: string, server = false) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (confirmationId: string) => {
      if (server) await approveServerManualConfirmation(tripId, confirmationId)
      else await approveManualConfirmation(tripId, confirmationId)
    },
    onSettled: () => refresh(client),
  })
}

export function useRejectManualConfirmMutation(tripId: string, server = false) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ confirmationId, reason }: { confirmationId: string; reason: string }) => {
      if (server) await rejectServerManualConfirmation(tripId, confirmationId, reason)
      else await rejectManualConfirmation(tripId, confirmationId, reason)
    },
    onSettled: () => refresh(client),
  })
}
