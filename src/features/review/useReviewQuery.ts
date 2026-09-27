import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decideReview, fetchPlanReview, fetchRecentDecisions, fetchReviewDecisions, fetchReviewQueue, type ReviewDecisionInput } from './review-api'

/**
 * Hook Query của duyệt phương án (LM-104). Hàng đợi đổi khi điều phối chạy tối ưu hoặc Duyệt ở Planner (khoá `['trips', …]`), nên
 * đọc lại mỗi lần mở màn. Quyết định của chuyến nằm dưới `['trips', tripId]` để mọi ghi của chuyến làm mới nó.
 */

export function useReviewQueueQuery() {
  return useQuery({ queryKey: ['review', 'queue'], queryFn: fetchReviewQueue, staleTime: 0 })
}

export function useReviewDecisionsQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'review-decisions'], queryFn: () => fetchReviewDecisions(tripId), enabled: tripId !== '', staleTime: 0 })
}

/** Số quyết định gần đây hiện cạnh hàng đợi. */
export const RECENT_DECISION_LIMIT = 5

export function useRecentDecisionsQuery() {
  return useQuery({ queryKey: ['review', 'recent'], queryFn: () => fetchRecentDecisions(RECENT_DECISION_LIMIT), staleTime: 0 })
}

/**
 * Trạng thái duyệt của revision đang xem ở Planner: còn chờ duyệt không (thanh quyết định), quyết định mới nhất (dòng dưới thanh trên)
 * và người đã duyệt. Vắng `revisionId` (fixture benchmark không có trong kho) thì không đọc.
 * Khoá nằm dưới `['review']`, **không** dưới `['trips', tripId]`: Duyệt chờ làm mới mọi truy vấn của chuyến rồi mới gọi callback mở
 * bản đã duyệt; thêm một truy vấn chậm vào đó thì Planner kịp dựng lại theo revision mới, phiên cũ bị gỡ và callback (toast, điều
 * hướng) không chạy. Bản duyệt là revision mới nên truy vấn này đọc lại theo khoá mới; quyết định làm mới `['review']`.
 */
export function usePlanReviewQuery(tripId: string, revisionId: string | undefined) {
  return useQuery({
    queryKey: ['review', 'plan', tripId, revisionId],
    queryFn: () => fetchPlanReview(tripId, revisionId ?? ''),
    enabled: tripId !== '' && revisionId !== undefined,
    staleTime: 0,
  })
}

/** Từ chối / yêu cầu tối ưu lại / đề xuất: phương án ra khỏi hàng đợi, chuyến và nhật ký đổi. */
export function useReviewDecisionMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ReviewDecisionInput) => decideReview(input),
    onSuccess: () => Promise.all([['review'], ['trips'], ['dashboard']].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}
