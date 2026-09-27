import type { VehicleConfig } from '@/domain/models'
import { getMockDb, isStale, type PlanSuggestion, type ReviewDecision, type ReviewQueueItem } from '@/lib/mock-db'
import type { User } from '@/types/user'

/**
 * Lớp dữ liệu duyệt phương án của quản lý (luồng 4 Review 1, LM-104): hàng đợi chờ duyệt và các quyết định ngoài Duyệt (từ chối, yêu
 * cầu tối ưu lại, đề xuất đổi xe / tách chuyến). Duyệt vẫn đi qua `approveRevision` của Planner (tạo revision mới, D-31).
 */

/** Một dòng hàng đợi: phương án chờ duyệt kèm xe, người chạy tối ưu và vài số của chuyến lấy từ kho. */
export type ReviewQueueRow = ReviewQueueItem & {
  readonly vehicle: VehicleConfig | undefined
  readonly submitter: User | undefined
  readonly stopCount: number
  /** Phương án chưa duyệt, còn dùng được (hoàn tất, không lỗi thời) của chuyến — từ 2 trở lên thì có "So sánh". */
  readonly candidateCount: number
  /** Lần chạy có yêu cầu thứ tự dỡ theo điểm giao (`request.settings.enforceLifo`). */
  readonly enforceLifo: boolean
}

export async function fetchReviewQueue(): Promise<ReviewQueueRow[]> {
  const db = getMockDb()
  const [queue, vehicles, users] = await Promise.all([db.listReviewQueue(), db.listVehicles(), db.listUsers()])
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const userById = new Map(users.map((user) => [user.id, user]))
  return Promise.all(queue.map(async (item) => {
    const [trip, revisions] = await Promise.all([db.getTrip(item.tripId), db.listRevisions(item.tripId)])
    const candidates = revisions.filter((revision) => revision.approvedAt === undefined && revision.result.status === 'COMPLETED' && !isStale(revision, trip))
    return {
      ...item,
      vehicle: vehicleById.get(item.vehicleId),
      submitter: item.submittedBy === null ? undefined : userById.get(item.submittedBy),
      stopCount: trip.stops.length,
      candidateCount: candidates.length,
      enforceLifo: revisions.find((revision) => revision.id === item.revisionId)?.request.settings.enforceLifo ?? false,
    }
  }))
}

/** Quyết định của một chuyến (hoặc mọi chuyến), cũ trước — thanh quyết định ở Planner và lịch sử ở chi tiết chuyến. */
export function fetchReviewDecisions(tripId?: string): Promise<ReviewDecision[]> {
  return getMockDb().listReviewDecisions(tripId)
}

/** Quyết định kèm tên người quyết định và tên xe đề xuất (nếu có). */
export type NamedDecision = ReviewDecision & { readonly byName: string | null; readonly vehicleName: string | null }

/** Quyết định gần đây của mọi chuyến, mới nhất trước — cột phụ của hàng đợi chờ duyệt. */
export async function fetchRecentDecisions(limit: number): Promise<NamedDecision[]> {
  const db = getMockDb()
  const [decisions, users, vehicles] = await Promise.all([db.listReviewDecisions(), db.listUsers(), db.listVehicles()])
  return decisions.toReversed().slice(0, limit).map((decision) => named(decision, users, vehicles))
}

function named(decision: ReviewDecision, users: readonly User[], vehicles: readonly VehicleConfig[]): NamedDecision {
  return {
    ...decision,
    byName: users.find((user) => user.id === decision.by)?.fullName ?? null,
    vehicleName: decision.vehicleId === undefined ? null : (vehicles.find((vehicle) => vehicle.id === decision.vehicleId)?.name ?? null),
  }
}

/** Trạng thái duyệt của một revision ở Planner: còn trong hàng đợi không, quyết định mới nhất, và ai đã duyệt. */
export type PlanReview = {
  readonly reviewable: boolean
  readonly decision: NamedDecision | null
  /** Tên người duyệt khi revision là bản đã duyệt: `approvedBy` của kho, bản seed cũ thì lấy từ nhật ký; không rõ thì `null`. */
  readonly approvedByName: string | null
  /** Xe để chọn trong đề xuất đổi xe. */
  readonly vehicles: readonly VehicleConfig[]
}

export async function fetchPlanReview(tripId: string, revisionId: string): Promise<PlanReview> {
  const db = getMockDb()
  const [revision, decisions, queue, users, vehicles] = await Promise.all([
    db.getRevision(revisionId), db.listReviewDecisions(tripId), db.listReviewQueue(), db.listUsers(), db.listVehicles(),
  ])
  const decision = decisions.findLast((item) => item.revisionId === revisionId)
  let approverId = revision.approvedBy ?? null
  if (revision.approvedAt !== undefined && approverId === null) {
    const events = await db.listEvents({ targetId: tripId })
    approverId = events.find((event) => event.action === 'revision.approved' && event.params.revisionId === revisionId)?.actorId ?? null
  }
  return {
    reviewable: queue.some((item) => item.revisionId === revisionId),
    decision: decision ? named(decision, users, vehicles) : null,
    approvedByName: revision.approvedAt === undefined ? null : (users.find((user) => user.id === approverId)?.fullName ?? null),
    vehicles,
  }
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
