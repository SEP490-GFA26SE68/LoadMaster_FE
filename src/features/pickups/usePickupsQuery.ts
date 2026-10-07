import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { PickupRequestInput } from '@/lib/mock-db'
import { createPickupRequest, fetchPickupRows, validatePickupRequest } from './pickups-api'

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

export function useCreatePickupMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: PickupRequestInput) => createPickupRequest(tripId, input), onSettled: () => refresh(client) })
}

export function useValidatePickupMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (pickupId: string) => validatePickupRequest(tripId, pickupId), onSettled: () => refresh(client) })
}
