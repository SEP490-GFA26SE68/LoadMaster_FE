import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  completeServerLoading,
  confirmServerPlacement,
  fetchServerLoadingSession,
  fetchServerWarehouseTrips,
  confirmServerPlacementManually,
  recordServerDeviation,
  recordServerSeal,
  reportServerDamaged,
  reportServerShortage,
  stageServerPackage,
  stageServerPackageManually,
  startServerLoading,
  WAREHOUSE_CAPABILITIES,
  type DeviationInput,
  type ServerLoadingSession,
  type ServerManualInput,
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

/** Phiên xếp của chuyến, đọc lại từ máy chủ ở thiết bị nào cũng được; `retry: false` — chuyến không còn đang xếp thì đọc lại vẫn vậy. */
export function useServerLoadingSessionQuery(tripId: string) {
  return useQuery({ queryKey: sessionKey(tripId), queryFn: () => fetchServerLoadingSession(tripId), staleTime: 0, retry: false })
}

/** Ghi của kho đổi trạng thái chuyến ở mọi màn đã đọc nó. Phiên mới đặt thẳng vào cache: không phải đọc lại. */
function settle(client: QueryClient, tripId: string, session: ServerLoadingSession | undefined) {
  if (session !== undefined) client.setQueryData(sessionKey(tripId), session)
  const keys = [['warehouse', 'server', 'trips'], ['trips'], ['dashboard'], ...(session === undefined ? [sessionKey(tripId)] : [])]
  return Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
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

/** Soạn một kiện bằng nhãn (quét hoặc gõ mã). */
export function useStageServerPackageMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ packageId, method }: { packageId: string; method: 'QR' | 'CODE' }) => stageServerPackage(tripId, packageId, method),
    onSuccess: (result) => settle(client, tripId, result.session),
  })
}

export function useStageServerPackageManuallyMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ packageId, input }: { packageId: string; input: ServerManualInput }) => stageServerPackageManually(tripId, packageId, input),
    onSuccess: (session) => settle(client, tripId, session),
  })
}

export function useReportServerShortageMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (packageId: string) => reportServerShortage(tripId, packageId),
    onSuccess: (session) => settle(client, tripId, session),
  })
}

export function useConfirmServerPlacementManuallyMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ placementId, input }: { placementId: string; input: ServerManualInput }) => confirmServerPlacementManually(tripId, placementId, input),
    onSuccess: (session) => settle(client, tripId, session),
  })
}

/** Kiện hỏng: chuyến về Đã lập kế hoạch thì không còn phiên — đọc lại phiên để màn nói điều đó. */
export function useReportServerDamagedMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (placementId: string) => reportServerDamaged(tripId, placementId),
    onSuccess: (result) => settle(client, tripId, result.outcome === 'leftOut' ? result.session : undefined),
  })
}

export function useRecordServerSealMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (sealNumber: string) => recordServerSeal(tripId, sealNumber), onSuccess: (session) => settle(client, tripId, session) })
}
