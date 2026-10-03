import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { LoadingStepInput, ManualConfirmInput } from '@/lib/mock-db'
import {
  completeLoading,
  confirmLoadingByQr,
  confirmLoadingManually,
  fetchTripLabels,
  fetchWarehouseTrip,
  fetchWarehouseTrips,
  recordLoadingStep,
  recordSeal,
  startLoading,
  type VerifyCodeInput,
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

/** Nhãn QR của chuyến — tên kiện và kiện kho kiện của từng instance cho hộp đối chiếu. Nhãn đổi khi dòng kiện đổi, không đổi trong phiên xếp. */
export function useTripLabelsQuery(tripId: string) {
  // Ngoài khoá `['warehouse']`: nhãn không đổi trong phiên xếp (chuyến đã khoá), mỗi bước ghi không phải đọc lại
  return useQuery({ queryKey: ['warehouse-labels', tripId], queryFn: () => fetchTripLabels(tripId), enabled: tripId !== '' })
}

/** Đối chiếu kiện của bước hiện tại bằng nhãn (quét hoặc gõ mã); trả mã instance vừa ghi. Lỗi của kho hiện trong hộp đối chiếu. */
export function useConfirmLoadingByQrMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: VerifyCodeInput) => confirmLoadingByQr(tripId, input), onSettled: () => refreshAfterWrite(client) })
}

/** Xác nhận tay kiện của bước hiện tại (mức 3, FE-6-03): kho ghi "đã xếp" kèm xác nhận tay chờ điều phối viên duyệt. */
export function useConfirmLoadingManuallyMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: ManualConfirmInput) => confirmLoadingManually(tripId, input), onSettled: () => refreshAfterWrite(client) })
}

export function useRecordSealMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (sealNumber: string) => recordSeal(tripId, sealNumber), onSettled: () => refreshAfterWrite(client) })
}
