import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { LoadingStepInput } from '@/lib/mock-db'
import {
  completeLoading,
  confirmLoadingByQr,
  fetchTripLabels,
  fetchWarehouseTrip,
  fetchWarehouseTrips,
  recordLoadingStep,
  recordSeal,
  startLoading,
} from './warehouse-api'

/**
 * Dữ liệu màn kho qua TanStack Query — component không gọi `warehouse-api.ts` trực tiếp (mục 9).
 * `staleTime: 0`: mở lại màn luôn đọc tiến độ mới nhất trong kho, kể cả khi vừa Duyệt ở Planner.
 */
export function useWarehouseTripsQuery() {
  return useQuery({ queryKey: ['warehouse', 'trips'], queryFn: fetchWarehouseTrips, staleTime: 0 })
}

export function useWarehouseTripQuery(tripId: string) {
  return useQuery({ queryKey: ['warehouse', 'trip', tripId], queryFn: () => fetchWarehouseTrip(tripId), staleTime: 0 })
}

/**
 * Ghi của kho đổi trạng thái chuyến ở mọi màn: danh sách kho, chuyến, bảng điều khiển, đội xe (xe đang chạy chuyến, D-53).
 * Trả promise để mutation chỉ xong khi màn đã đọc lại dữ liệu mới — không có khoảnh khắc hiện lại kiện vừa ghi.
 */
function refreshAfterWrite(client: QueryClient) {
  return Promise.all(
    [['warehouse'], ['trips'], ['dashboard'], ['vehicles']].map((queryKey) => client.invalidateQueries({ queryKey })),
  )
}

/** Bắt đầu xếp. Kể cả khi bị từ chối (ví dụ máy khác vừa bắt đầu trước), đọc lại để màn theo đúng pha trong kho. */
export function useStartLoadingMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => startLoading(tripId), onSettled: () => refreshAfterWrite(client) })
}

export function useRecordLoadingStepMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (step: LoadingStepInput) => recordLoadingStep(tripId, step), onSettled: () => refreshAfterWrite(client) })
}

export function useCompleteLoadingMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => completeLoading(tripId), onSettled: () => refreshAfterWrite(client) })
}

// Review 1 (LM-104)

/** Nhãn QR của chuyến — danh sách chọn tay trong hộp thoại quét. Nhãn đổi khi dòng kiện đổi, không đổi trong phiên xếp. */
export function useTripLabelsQuery(tripId: string) {
  return useQuery({ queryKey: ['warehouse', 'labels', tripId], queryFn: () => fetchTripLabels(tripId), enabled: tripId !== '' })
}

/** Quét QR xác nhận kiện của bước hiện tại; trả mã instance vừa ghi. Lỗi `QR_WRONG_PACKAGE` / `QR_NOT_IN_TRIP` hiện qua `dataErrorMessage`. */
export function useConfirmLoadingByQrMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (token: string) => confirmLoadingByQr(tripId, token), onSettled: () => refreshAfterWrite(client) })
}

export function useRecordSealMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (sealNumber: string) => recordSeal(tripId, sealNumber), onSettled: () => refreshAfterWrite(client) })
}
