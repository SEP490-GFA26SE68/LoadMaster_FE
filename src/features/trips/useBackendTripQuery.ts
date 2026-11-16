import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignBackendRequirementToTrip,
  fetchBackendActiveRoutePlan,
  fetchTripById,
  resolveBackendTripId,
} from './trips-api'

/**
 * Hook Query của Chi tiết chuyến, Thiết lập tối ưu và So sánh khi nhóm `trips` nối backend (mục 9: component không gọi `-api.ts`).
 * Mọi khoá nằm dưới `['trips', tripId]` để ghi của chuyến làm mới chúng.
 */

/** Mã trên URL (mã chuyến hoặc mã số) → mã số của máy chủ; không đổi trong phiên. */
export function useBackendTripIdQuery(tripId: string, enabled = true) {
  return useQuery({
    queryKey: ['trips', tripId, 'backend-id'],
    queryFn: () => resolveBackendTripId(tripId),
    enabled: enabled && tripId !== '',
    staleTime: Infinity,
  })
}

/** Khung chuyến cho đầu Chi tiết chuyến (`GET /api/trips/{id}`). */
export function useBackendTripHeaderQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'backend-header'], queryFn: () => fetchTripById(tripId), enabled: tripId !== '' })
}

/** Tuyến đang dùng của chuyến (`GET /api/trips/{id}/route-plans/active`); lỗi không thử lại — màn nói ra. */
export function useBackendActiveRoutePlanQuery(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'active-route-plan'],
    queryFn: () => fetchBackendActiveRoutePlan(tripId),
    enabled: tripId !== '',
    retry: false,
  })
}

/** Đưa yêu cầu giao vào chuyến Nháp: chuyến và danh sách yêu cầu giao đổi theo. */
export function useAssignBackendRequirementMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (requirementId: string) => assignBackendRequirementToTrip(tripId, requirementId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['requirements'] }),
      client.invalidateQueries({ queryKey: ['trips'] }),
    ]),
  })
}
