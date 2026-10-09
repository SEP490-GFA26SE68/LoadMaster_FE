import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlacementPatch } from '@/domain/constraints'
import { approveLoadPlan, fetchPlanApproval, fetchPlanSource } from './viewer-api'

/** Phương án của chuyến qua TanStack Query; component không gọi `viewer-api.ts` trực tiếp (mục 9). */
export function usePlanSourceQuery(tripId: string, ref?: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'plan', { ref }],
    queryFn: () => fetchPlanSource(tripId, ref),
  })
}

/**
 * Người đã duyệt revision đang xem ở Planner. Vắng `revisionId` (fixture benchmark không có trong kho) thì không đọc.
 * Khoá `['plan-approval', revisionId]`, **không** dưới `['trips', tripId]`: Duyệt chờ làm mới mọi truy vấn của chuyến rồi mới gọi
 * callback mở bản đã duyệt; thêm một truy vấn nữa vào đó thì Planner kịp dựng lại theo revision mới, phiên cũ bị gỡ và callback
 * (toast, điều hướng) không chạy. Revision bất biến (D-31) — bản duyệt là revision mới, đọc theo khoá mới — nên không cần làm mới.
 */
export function usePlanApprovalQuery(revisionId: string | undefined) {
  return useQuery({
    queryKey: ['plan-approval', revisionId],
    queryFn: () => fetchPlanApproval(revisionId ?? ''),
    enabled: revisionId !== undefined,
  })
}

/**
 * Duyệt phương án (kèm bản chỉnh tay nếu có): xong thì làm mới revision của chuyến (Planner đọc bản approved) và bảng điều khiển.
 * `force`: người duyệt đã xác nhận duyệt dù tuyến có điểm trễ hạn dự kiến (FE-5b-08).
 */
export function useApproveRevisionMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ revisionId, patches, pinned, force = false }: { revisionId: string; patches: readonly PlacementPatch[]; pinned?: readonly string[]; force?: boolean }) =>
      approveLoadPlan(revisionId, patches, { force, pinned }),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips', tripId] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  })
}
