import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelBackendTrip, removeBackendRequirement, updateBackendTrip, type BackendTripChanges } from './trip-edit-backend-api'

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

export function useRemoveBackendRequirementMutation(tripId: string) {
  const refresh = useRefresh()
  return useMutation({ mutationFn: (requirementId: string) => removeBackendRequirement(tripId, requirementId), onSuccess: refresh })
}
