import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { approveManualConfirmation, fetchManualConfirmations, rejectManualConfirmation } from './manual-confirm-api'

/**
 * Hook Query cho thẻ "Xác nhận tay chờ duyệt" (FE-6-04). Khoá đọc nằm dưới `['trips', tripId]`: mọi ghi của chuyến làm mới nó. Duyệt
 * hoặc từ chối đổi dòng phụ của chuyến ở mọi màn và tiến độ kho / tài xế đang đọc, nên làm mới cả chuyến, danh sách kho, bảng điều
 * khiển và chuông.
 */
export function useManualConfirmationsQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'manual-confirms'], queryFn: () => fetchManualConfirmations(tripId), enabled: tripId !== '', staleTime: 0 })
}

function refresh(client: QueryClient) {
  return Promise.all([['trips'], ['warehouse'], ['dashboard'], ['notifications']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

export function useApproveManualConfirmMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (confirmationId: string) => approveManualConfirmation(tripId, confirmationId), onSettled: () => refresh(client) })
}

export function useRejectManualConfirmMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ confirmationId, reason }: { confirmationId: string; reason: string }) => rejectManualConfirmation(tripId, confirmationId, reason),
    onSettled: () => refresh(client),
  })
}
