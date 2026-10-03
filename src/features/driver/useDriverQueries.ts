import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import type { DeliveryIssueInput, ManualConfirmInput } from '@/lib/mock-db'
import {
  arriveAtStop,
  completeStop,
  confirmUnloadByQr,
  confirmUnloadManually,
  fetchDriverTripLabels,
  fetchDriverTrip,
  fetchMyTrips,
  reportDeliveryIssue,
  startDelivery,
  type UnloadVerifyInput,
} from './driver-api'

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

/** Ghi của tài xế đổi trạng thái chuyến ở mọi màn: chuyến, bảng điều khiển, đội xe (xe hết chạy khi chuyến hoàn thành, D-53). */
function refreshAfterWrite(client: QueryClient) {
  return Promise.all([['trips'], ['dashboard'], ['vehicles']].map((queryKey) => client.invalidateQueries({ queryKey })))
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
  return useMutation({ mutationFn: (stopNumber: number) => completeStop(tripId, stopNumber), onSettled: () => refreshAfterWrite(client) })
}

// Review 1 (LM-104): quét QR khi dỡ

export function useDriverTripLabelsQuery(tripId: string) {
  // Ngoài khoá `['trips']`: nhãn không đổi khi đang giao (chuyến đã khoá), mỗi lần ghi dỡ không phải đọc lại — và lượt ghi không phải
  // chờ lần đọc lại đó trước khi xong
  return useQuery({ queryKey: ['driver', 'labels', tripId], queryFn: () => fetchDriverTripLabels(tripId), enabled: tripId !== '' })
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
