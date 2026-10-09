import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { PickupApproveInput, PickupRequestInput } from '@/lib/mock-db'
import { approvePickupRequest, createPickupRequest, fetchPickupRows, rejectPickupRequest, validatePickupRequest } from './pickups-api'

/**
 * Hook Query của nhận hàng dọc đường (FE-7-03). Khoá nằm dưới `['trips', tripId]`: mọi ghi của chuyến làm mới danh sách yêu cầu.
 * Một yêu cầu mới làm chuông của điều phối viên đổi, nên làm mới cả `['notifications']`.
 */
export function usePickupRequestsQuery(tripId: string, enabled = true) {
  return useQuery({ queryKey: ['trips', tripId, 'pickups'], queryFn: () => fetchPickupRows(tripId), enabled: enabled && tripId !== '', staleTime: 0 })
}

function refresh(client: QueryClient) {
  return Promise.all([['trips'], ['notifications']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

/** Duyệt tạo kiện kho kiện, chèn điểm vào tuyến và thêm nhãn của chuyến: làm mới cả kho kiện, nhãn của tài xế và kho, bảng điều khiển. */
function refreshAfterApproval(client: QueryClient) {
  return Promise.all([['trips'], ['notifications'], ['package-pool'], ['driver'], ['warehouse-labels'], ['dashboard']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

export function useCreatePickupMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: PickupRequestInput) => createPickupRequest(tripId, input), onSettled: () => refresh(client) })
}

export function useValidatePickupMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (pickupId: string) => validatePickupRequest(tripId, pickupId), onSettled: () => refresh(client) })
}

export function useApprovePickupMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ pickupId, input }: { pickupId: string; input?: PickupApproveInput }) => approvePickupRequest(tripId, pickupId, input),
    onSettled: () => refreshAfterApproval(client),
  })
}

export function useRejectPickupMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ pickupId, reason }: { pickupId: string; reason: string }) => rejectPickupRequest(tripId, pickupId, reason),
    onSettled: () => refresh(client),
  })
}
