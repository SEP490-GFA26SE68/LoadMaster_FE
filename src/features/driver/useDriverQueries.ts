import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { pollInterval } from '@/lib/polling'
import { useAuth } from '@/features/auth/AuthProvider'
import type { StopRef } from '@/features/pickups/pickup-stops'
import type { DeliveryIssueInput, ManualConfirmInput } from '@/lib/mock-db'
import {
  arriveAtStop,
  completeStop,
  confirmUnloadByQr,
  confirmUnloadManually,
  DRIVER_CAPABILITIES,
  fetchDriverLoadPlan,
  fetchDriverStopScreen,
  fetchDriverStopTimes,
  fetchDriverTripLabels,
  fetchDriverTripMonitoring,
  fetchDriverTrip,
  fetchMyTrips,
  reportDeliveryIssue,
  startDelivery,
  type DriverCapabilities,
  type UnloadVerifyInput,
} from './driver-api'

/** Màn tài xế làm được gì với nguồn dữ liệu đang dùng (kho mẫu hay backend): component đọc ở đây để ẩn phần chưa có (D-20). */
export function useDriverCapabilities(): DriverCapabilities {
  return DRIVER_CAPABILITIES
}

/**
 * Dữ liệu màn tài xế qua TanStack Query — component không gọi `driver-api.ts` trực tiếp (mục 9). Khoá nằm dưới `['trips']` nên mọi
 * ghi vào chuyến ở màn khác cũng làm mới màn này. `staleTime: 0`: mở lại màn luôn đọc tiến độ mới nhất trong kho.
 */
export function useMyTripsQuery() {
  const { user } = useAuth()
  // Người đăng nhập nằm trong khoá: đổi tài khoản không dùng lại danh sách của người trước
  return useQuery({ queryKey: ['trips', 'driver', 'mine', user?.id ?? null], queryFn: fetchMyTrips, staleTime: 0 })
}

function tripKey(tripId: string) {
  return ['trips', 'driver', 'trip', tripId] as const
}

export function useDriverTripQuery(tripId: string) {
  return useQuery({ queryKey: tripKey(tripId), queryFn: () => fetchDriverTrip(tripId), staleTime: 0 })
}

/** Màn điểm giao theo backend: dưới `['trips']` nên mỗi lần dỡ, hoàn tất điểm (`refreshAfterWrite`) đọc lại điểm đang giao. */
export function useDriverStopScreenQuery(tripId: string) {
  return useQuery({ queryKey: [...tripKey(tripId), 'stop-screen'], queryFn: () => fetchDriverStopScreen(tripId), staleTime: 0 })
}

/**
 * Vị trí xe và giờ đến dự kiến trực tiếp của chuyến Đang vận chuyển (FE-6-09). Đọc lại theo `refreshMs` kho trả — lúc có điểm vị trí kế
 * tiếp; chuyến hết chạy thì `refreshMs` là `null`, hết nhịp. `enabled` tắt khi màn không cần (chưa xuất phát, chưa có tuyến, đã đến điểm):
 * không có hẹn giờ riêng, gỡ màn là hết nhịp.
 */
export function useDriverTripMonitoringQuery(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...tripKey(tripId), 'monitoring'],
    queryFn: () => fetchDriverTripMonitoring(tripId),
    enabled,
    staleTime: 0,
    refetchInterval: (query) => pollInterval(query, query.state.data?.refreshMs),
  })
}

/** Ghi của tài xế đổi trạng thái chuyến ở mọi màn: chuyến, bảng điều khiển, đội xe (xe hết chạy khi chuyến hoàn thành, D-53). */
function refreshAfterWrite(client: QueryClient, except?: (key: readonly unknown[]) => boolean) {
  return Promise.all(
    [['trips'], ['dashboard'], ['vehicles']].map((queryKey) => client.invalidateQueries({ queryKey, predicate: except ? (query) => !except(query.queryKey) : undefined })),
  )
}

/** Khoá phương án đã xếp của khung 3D tài xế (`useDriverLoadPlanQuery`). */
function isLoadPlanKey(key: readonly unknown[]): boolean {
  return key.length === 5 && key[0] === 'trips' && key[1] === 'driver' && key[4] === 'load-plan'
}

export function useStartDeliveryMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => startDelivery(tripId), onSettled: () => refreshAfterWrite(client) })
}

/** Tài xế bấm "Đã đến" ở điểm `stopNumber` (FE-6-06). */
export function useArriveMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (stopNumber: number) => arriveAtStop(tripId, stopNumber), onSettled: () => refreshAfterWrite(client) })
}

export function useReportIssueMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (issue: DeliveryIssueInput) => reportDeliveryIssue(tripId, issue),
    onSettled: () => refreshAfterWrite(client),
  })
}

export function useCompleteStopMutation(tripId: string) {
  const client = useQueryClient()
  // Hoàn tất điểm không đổi kiện trên xe (chỉ dỡ mới đổi), nên không đọc lại phương án đã xếp: hoàn tất điểm cuối thì chuyến đã giao xong
  // và máy chủ không còn trả phương án — đọc lại là một lượt 404 thừa trước khi màn sang "Đã giao xong chuyến".
  return useMutation({ mutationFn: (stopNumber: number) => completeStop(tripId, stopNumber), onSettled: () => refreshAfterWrite(client, isLoadPlanKey) })
}

// Review 1 (LM-104): quét QR khi dỡ

export function useDriverTripLabelsQuery(tripId: string) {
  // Ngoài khoá `['trips']`: nhãn không đổi khi đang giao (chuyến đã khoá), mỗi lần ghi dỡ không phải đọc lại — và lượt ghi không phải
  // chờ lần đọc lại đó trước khi xong
  // Backend chưa có nhãn của chuyến cho tài xế: chỉ kho mẫu đọc
  return useQuery({ queryKey: ['driver', 'labels', tripId], queryFn: () => fetchDriverTripLabels(tripId), enabled: tripId !== '' && !DRIVER_CAPABILITIES.backend })
}

/** Đối chiếu bằng nhãn (quét hoặc gõ mã) để ghi dỡ một kiện ở điểm `stopNumber` (điểm hiện tại). Trả mã instance vừa ghi. */
export function useConfirmUnloadByQrMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: UnloadVerifyInput) => confirmUnloadByQr(tripId, input), onSettled: () => refreshAfterWrite(client) })
}

/** Xác nhận tay một kiện ở điểm hiện tại (mức 3, FE-6-03): ghi "đã dỡ" kèm xác nhận tay chờ điều phối viên duyệt. */
export function useConfirmUnloadManuallyMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ stopNumber, input }: { stopNumber: number; input: ManualConfirmInput }) => confirmUnloadManually(tripId, stopNumber, input),
    onSettled: () => refreshAfterWrite(client),
  })
}

// Nguồn backend: phương án đã xếp và giờ đến các điểm (kho mẫu đọc cả hai từ `useDriverTripQuery`)

/** Phương án kho đã xếp cho khung 3D "Xem vị trí hàng": dưới khoá chuyến nên mỗi lần dỡ đọc lại kiện còn trên xe. */
export function useDriverLoadPlanQuery(tripId: string) {
  return useQuery({ queryKey: [...tripKey(tripId), 'load-plan'], queryFn: () => fetchDriverLoadPlan(tripId), enabled: DRIVER_CAPABILITIES.backend && tripId !== '', staleTime: 0 })
}

/** Giờ đến và hạn giao các điểm theo máy chủ; đọc lại theo `refreshMs` máy chủ trả khi chuyến Đang vận chuyển, không thì hết nhịp. */
export function useDriverStopTimesQuery(tripId: string) {
  return useQuery(stopTimesOptions(tripId))
}

/**
 * Chỉ mã và tên các điểm của cùng truy vấn giờ đến: màn điểm giao đọc nó ở gốc màn, và `select` giữ nguyên mảng khi mã, tên không đổi
 * nên mỗi nhịp đọc lại giờ đến không vẽ lại cả màn.
 */
export function useDriverStopRefsQuery(tripId: string) {
  return useQuery({ ...stopTimesOptions(tripId), select: stopRefsOf })
}

function stopTimesOptions(tripId: string) {
  return queryOptions({
    queryKey: [...tripKey(tripId), 'stop-times'],
    queryFn: () => fetchDriverStopTimes(tripId),
    enabled: DRIVER_CAPABILITIES.backend && tripId !== '',
    staleTime: 0,
    refetchInterval: (query) => pollInterval(query, query.state.data?.refreshMs),
  })
}

function stopRefsOf(data: Awaited<ReturnType<typeof fetchDriverStopTimes>>): StopRef[] {
  return data.stops.map((stop) => ({ id: stop.id ?? '', name: stop.name }))
}
