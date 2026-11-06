import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  completeServerLoading,
  confirmServerPlacement,
  fetchServerLoadingSession,
  fetchServerWarehouseTrips,
  recordServerDeviation,
  startServerLoading,
  WAREHOUSE_CAPABILITIES,
  type DeviationInput,
  type ServerLoadingSession,
  type WarehouseCapabilities,
} from './warehouse-server-api'

/** Màn kho làm được gì với nguồn dữ liệu đang dùng: component đọc ở đây để chọn bản máy chủ và ẩn phần chưa có (D-20). */
export function useWarehouseCapabilities(): WarehouseCapabilities {
  return WAREHOUSE_CAPABILITIES
}

const sessionKey = (tripId: string) => ['warehouse', 'server', 'session', tripId] as const

/** Danh sách chuyến của kho bản máy chủ. `staleTime: 0`: điều phối vừa duyệt ở máy khác thì mở lại màn là thấy. */
export function useServerWarehouseTripsQuery() {
  return useQuery({ queryKey: ['warehouse', 'server', 'trips'], queryFn: fetchServerWarehouseTrips, staleTime: 0 })
}

/** Phiên xếp tab này đang giữ; `retry: false` — phiên không có ở tab này thì đọc lại cũng không có. */
export function useServerLoadingSessionQuery(tripId: string) {
  return useQuery({ queryKey: sessionKey(tripId), queryFn: () => fetchServerLoadingSession(tripId), staleTime: 0, retry: false })
}

/** Ghi của kho đổi trạng thái chuyến ở mọi màn đã đọc nó. Phiên mới đặt thẳng vào cache: không phải đọc lại. */
function settle(client: QueryClient, tripId: string, session: ServerLoadingSession | undefined) {
  if (session !== undefined) client.setQueryData(sessionKey(tripId), session)
  return Promise.all([['warehouse', 'server', 'trips'], ['trips'], ['dashboard']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

export function useStartServerLoadingMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => startServerLoading(tripId), onSuccess: (session) => settle(client, tripId, session) })
}

export function useConfirmServerPlacementMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (placementId: string) => confirmServerPlacement(tripId, placementId),
    onSuccess: (session) => settle(client, tripId, session),
  })
}

export function useRecordServerDeviationMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ placementId, input }: { placementId: string; input: DeviationInput }) => recordServerDeviation(tripId, placementId, input),
    onSuccess: (session) => settle(client, tripId, session),
  })
}

export function useCompleteServerLoadingMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => completeServerLoading(tripId), onSuccess: (session) => settle(client, tripId, session) })
}
