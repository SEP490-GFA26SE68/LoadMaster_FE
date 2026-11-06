import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ShortageDecision } from '@/lib/mock-db'
import { fetchStagingShortages, resolveStagingShortage, type ShortageRow } from './shortage-api'
import { fetchServerStagingShortages, resolveServerStagingShortage } from './shortage-backend-api'

/**
 * Hook Query cho thẻ "Kiện kho báo thiếu" (FE-6-02). Khoá đọc nằm dưới `['trips', tripId]`: mọi ghi của chuyến làm mới nó. Quyết định
 * của điều phối viên đổi trạng thái chuyến ở mọi màn, kiện của kho kiện (cờ), yêu cầu giao (giao thiếu) và chuông, nên làm mới hết.
 * `server`: báo thiếu của máy chủ (Chi tiết chuyến của máy chủ, `tripId` là mã số) thay vì kho mẫu.
 */
export function useStagingShortagesQuery(tripId: string, server = false) {
  return useQuery({
    queryKey: ['trips', tripId, 'shortages', server ? 'server' : 'store'],
    queryFn: () => (server ? fetchServerStagingShortages(tripId) : fetchStagingShortages(tripId)),
    enabled: tripId !== '',
    staleTime: 0,
  })
}

const AFFECTED = [['trips'], ['warehouse'], ['dashboard'], ['vehicles'], ['package-pool'], ['requirements'], ['notifications']] as const

export function useResolveShortageMutation(tripId: string, server = false) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ row, decision }: { row: ShortageRow; decision: ShortageDecision }) => {
      if (server) await resolveServerStagingShortage(tripId, row.id, decision)
      else await resolveStagingShortage(tripId, row.packageInstanceId, decision)
    },
    onSettled: () => Promise.all(AFFECTED.map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}
