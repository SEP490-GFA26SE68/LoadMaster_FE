import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ShortageDecision } from '@/lib/mock-db'
import { fetchStagingShortages, resolveStagingShortage } from './shortage-api'

/**
 * Hook Query cho thẻ "Kiện kho báo thiếu" (FE-6-02). Khoá đọc nằm dưới `['trips', tripId]`: mọi ghi của chuyến làm mới nó. Quyết định
 * của điều phối viên đổi trạng thái chuyến ở mọi màn, kiện của kho kiện (cờ), yêu cầu giao (giao thiếu) và chuông, nên làm mới hết.
 */
export function useStagingShortagesQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'shortages'], queryFn: () => fetchStagingShortages(tripId), enabled: tripId !== '', staleTime: 0 })
}

const AFFECTED = [['trips'], ['warehouse'], ['dashboard'], ['vehicles'], ['package-pool'], ['requirements'], ['notifications']] as const

export function useResolveShortageMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ packageInstanceId, decision }: { packageInstanceId: string; decision: ShortageDecision }) =>
      resolveStagingShortage(tripId, packageInstanceId, decision),
    onSettled: () => Promise.all(AFFECTED.map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}
