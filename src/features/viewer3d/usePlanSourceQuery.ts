import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlacementPatch } from '@/domain/constraints'
import { approvePlanRevision, fetchPlanApproval, fetchPlanSource, saveEditedPlanRevision } from './viewer-api'

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

/** Lưu bản chỉnh (LM-108): xong thì làm mới revision của chuyến và hàng đợi duyệt của quản lý. */
export function useSaveEditedRevisionMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ revisionId, patches }: { revisionId: string; patches: readonly PlacementPatch[] }) => saveEditedPlanRevision(revisionId, patches),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips', tripId] }),
      client.invalidateQueries({ queryKey: ['review'] }),
    ]),
  })
}

/** Duyệt phương án: xong thì làm mới revision của chuyến (Planner đọc bản approved) và bảng điều khiển. */
export function useApproveRevisionMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ revisionId, patches }: { revisionId: string; patches: readonly PlacementPatch[] }) => approvePlanRevision(revisionId, patches),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips', tripId] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  })
}
