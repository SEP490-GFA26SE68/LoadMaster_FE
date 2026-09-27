import type { VehicleConfig } from '@/domain/models'
import { getMockDb, type PlanSuggestion, type ReviewDecision, type ReviewQueueItem } from '@/lib/mock-db'
import type { User } from '@/types/user'

/**
 * Lớp dữ liệu duyệt phương án của quản lý (luồng 4 Review 1, LM-104): hàng đợi chờ duyệt và các quyết định ngoài Duyệt (từ chối, yêu
 * cầu tối ưu lại, đề xuất đổi xe / tách chuyến). Duyệt vẫn đi qua `approveRevision` của Planner (tạo revision mới, D-31).
 */

/** Một dòng hàng đợi: phương án chờ duyệt kèm xe và người chạy tối ưu. */
export type ReviewQueueRow = ReviewQueueItem & {
  readonly vehicle: VehicleConfig | undefined
  readonly submitter: User | undefined
}

export async function fetchReviewQueue(): Promise<ReviewQueueRow[]> {
  const db = getMockDb()
  const [queue, vehicles, users] = await Promise.all([db.listReviewQueue(), db.listVehicles(), db.listUsers()])
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const userById = new Map(users.map((user) => [user.id, user]))
  return queue.map((item) => ({
    ...item,
    vehicle: vehicleById.get(item.vehicleId),
    submitter: item.submittedBy === null ? undefined : userById.get(item.submittedBy),
  }))
}

/** Quyết định của một chuyến (hoặc mọi chuyến), cũ trước — thanh quyết định ở Planner và lịch sử ở chi tiết chuyến. */
export function fetchReviewDecisions(tripId?: string): Promise<ReviewDecision[]> {
  return getMockDb().listReviewDecisions(tripId)
}

/** Một quyết định trả lại phương án; lý do / ghi chú bắt buộc (`REASON_REQUIRED`). */
export type ReviewDecisionInput =
  | { readonly kind: 'reject'; readonly revisionId: string; readonly reason: string }
  | { readonly kind: 'reoptimize'; readonly revisionId: string; readonly reason: string }
  | { readonly kind: 'suggest'; readonly revisionId: string; readonly suggestion: PlanSuggestion }

export function decideReview(input: ReviewDecisionInput): Promise<ReviewDecision> {
  const db = getMockDb()
  switch (input.kind) {
    case 'reject':
      return db.rejectRevision(input.revisionId, input.reason)
    case 'reoptimize':
      return db.requestReoptimization(input.revisionId, input.reason)
    case 'suggest':
      return db.suggestPlanChange(input.revisionId, input.suggestion)
  }
}
