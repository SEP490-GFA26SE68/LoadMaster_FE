import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { decideReview, fetchReviewDecisions, fetchReviewQueue, type ReviewDecisionInput } from './review-api'

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

/** Từ chối / yêu cầu tối ưu lại / đề xuất: phương án ra khỏi hàng đợi, chuyến và nhật ký đổi. */
export function useReviewDecisionMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ReviewDecisionInput) => decideReview(input),
    onSuccess: () => Promise.all([['review'], ['trips'], ['dashboard']].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}
