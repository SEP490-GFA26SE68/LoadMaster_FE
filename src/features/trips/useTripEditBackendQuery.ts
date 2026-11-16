import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelBackendTrip, listBackendTripExceptions, removeBackendRequirement, updateBackendTrip, type BackendTripChanges } from './trip-edit-backend-api'
import { fetchBackendTripDetail, resolveBackendTripId } from './trips-api'

/** Mã trên URL (mã chuyến hoặc mã số) đổi sang mã số của máy chủ; cùng khoá với Chi tiết chuyến nên không tra lại. */
export function useBackendTripIdQuery(idOrCode: string) {
  return useQuery({ queryKey: ['trips', idOrCode, 'backend-id'], queryFn: () => resolveBackendTripId(idOrCode), enabled: idOrCode !== '', staleTime: Infinity })
}

/** Chi tiết chuyến của máy chủ theo mã số; cùng khoá với Chi tiết chuyến nên sửa xong màn chi tiết đọc lại. */
export function useBackendTripDetailQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'backend-detail'], queryFn: () => fetchBackendTripDetail(tripId), enabled: tripId !== '' })
}

/**
 * Lệnh ghi của Chi tiết chuyến bản máy chủ. Sửa, huỷ, gỡ yêu cầu đổi điểm giao, tuyến, phương án của chuyến và yêu cầu giao: làm mới
 * mọi khoá dưới `['trips']` (danh sách, chi tiết, phương án) và `['requirements']`.
 */
function useRefresh() {
  const client = useQueryClient()
  return () => Promise.all([
    client.invalidateQueries({ queryKey: ['trips'] }),
    client.invalidateQueries({ queryKey: ['requirements'] }),
    client.invalidateQueries({ queryKey: ['package-pool'] }),
  ])
}

export function useUpdateBackendTripMutation(tripId: string) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: (changes: BackendTripChanges) => updateBackendTrip(tripId, changes), onSuccess: refresh })
}

export function useCancelBackendTripMutation(tripId: string) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: (reason: string) => cancelBackendTrip(tripId, reason), onSuccess: refresh })
}

/** Sự cố của chuyến, đọc khi hộp huỷ chuyến Đang vận chuyển mở; luôn đọc lại vì sự cố đổi ở màn Giám sát. */
export function useBackendTripExceptionsQuery(tripId: string, enabled: boolean) {
  return useQuery({ queryKey: ['trips', tripId, 'backend-exceptions'], queryFn: () => listBackendTripExceptions(tripId), enabled: enabled && tripId !== '', staleTime: 0 })
}

export function useRemoveBackendRequirementMutation(tripId: string) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: (requirementId: string) => removeBackendRequirement(tripId, requirementId), onSuccess: refresh })
}
