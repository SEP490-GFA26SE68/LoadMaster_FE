/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   fetchPlanSource     → theo jobId: GET /api/v1/optimization/jobs/{id}/plans; theo chuyến, theo mã revision: chưa có ở BE
 *   approveLoadPlan     → POST /api/load-plans/{id}/approve (`force`; FastAPI đang có: POST /api/v1/load-plans/{id}/approve);
 *                         ghim: POST /api/load-plans/{id}/pin · DELETE /api/load-plans/{id}/pin/{placementId} (mock gửi cả tập ghim cùng lần Duyệt)
 *   chưa có ở BE: fetchPlanApproval
 * Đổi xe của chuyến từ Planner (changeTripVehicle → POST /api/trips/{id}/change-vehicle): `trips/trip-vehicle-api.ts`.
 */

import type { PlacementPatch } from '@/domain/constraints'
import { PLAN_LABELS, type PlanLabel } from '@/domain/models'
import { getMockDb, type ApproveOptions, type Revision, type Trip } from '@/lib/mock-db'

export type PlanSource = { readonly trip: Trip; readonly revision: Revision }

/**
 * Lớp dữ liệu của Planner (LM-030): nơi duy nhất trong `viewer3d` biết về kho. Nối backend thật chỉ thay thân hàm.
 *
 * Chọn revision: `ref` là mã revision thì lấy đúng bản đó; là `jobId` thì lấy revision mới nhất của job (bản đã duyệt dùng chung
 * `jobId` với bản nguồn nên bản đã duyệt thắng — Tối ưu mở bằng `jobId`, Duyệt và So sánh mở bằng mã revision); không có thì lấy revision đã duyệt mới nhất, rồi tới revision mới nhất. Chuyến chưa có revision nào
 * trả `revision: undefined` để màn hiện trạng thái rỗng thay vì phương án giả.
 */
// GET /api/v1/optimization/jobs/{id}/plans (theo jobId); theo chuyến, theo mã revision: chưa có ở BE
export async function fetchPlanSource(tripId: string, ref?: string): Promise<{ trip: Trip; revision?: Revision }> {
  const db = getMockDb()
  const [trip, revisions] = await Promise.all([db.getTrip(tripId), db.listRevisions(tripId)])
  const newestFirst = revisions.toReversed()
  const revision = ref
    ? (newestFirst.find((item) => item.id === ref) ?? newestFirst.find((item) => item.jobId === ref))
    : (newestFirst.find((item) => item.approvedAt !== undefined) ?? newestFirst[0])
  return { trip, revision }
}

/** Trạng thái duyệt của một revision ở thanh trên Planner ("Duyệt bởi … lúc …"). */
export type PlanApproval = {
  /** Họ tên người bấm Duyệt; `null` khi revision chưa duyệt, hoặc kho không biết người duyệt (duyệt khi không có phiên, tài khoản đã xoá). */
  readonly approvedByName: string | null
  /**
   * Revision là một phương án ứng viên (hoặc bản duyệt dựng từ nó) của lần chạy có nhiều phương án (FE-5b-05): mã lần chạy và nhãn
   * A · B · C theo mục tiêu. `null` khi lần chạy chỉ có một phương án, hoặc revision không thuộc lần chạy nào.
   */
  readonly candidate: { readonly runId: string; readonly label: PlanLabel } | null
}

/**
 * Ai đã duyệt revision — kho ghi người bấm Duyệt vào revision đã duyệt (`approvedBy`), tên lấy từ danh sách người dùng — và revision
 * là phương án ứng viên nào của lần chạy nào.
 */
// chưa có ở BE
export async function fetchPlanApproval(revisionId: string): Promise<PlanApproval> {
  const db = getMockDb()
  const [revision, users] = await Promise.all([db.getRevision(revisionId), db.listUsers()])
  const approverId = revision.approvedAt === undefined ? null : (revision.approvedBy ?? null)
  const run = revision.runId === undefined ? undefined : (await db.listOptimizationRuns(revision.tripId)).find((item) => item.id === revision.runId)
  const objective = revision.run?.objective
  const isCandidate = run !== undefined && objective !== undefined && (run.plans?.length ?? 0) > 1 && run.plans?.some((plan) => plan.objective === objective)
  return {
    approvedByName: users.find((user) => user.id === approverId)?.fullName ?? null,
    candidate: isCandidate ? { runId: run.id, label: PLAN_LABELS[objective] } : null,
  }
}

/**
 * Duyệt (LM-050, D-31): kho tạo revision approved mới từ revision đang xem và patch của draft — bản chỉnh tay được duyệt cùng lúc
 * (FE-0-07); revision nguồn giữ nguyên. `force` (FE-5b-08, D-80): người duyệt đã xác nhận duyệt dù tuyến có điểm trễ hạn dự kiến —
 * thiếu nó kho từ chối `LATE_STOPS_UNCONFIRMED`; lý do chặn (`APPROVAL_BLOCKED`, `REVISION_STALE`) thì `force` không gỡ được.
 * `pinned` (FE-BL-02): mã các kiện ghim của bản duyệt — ghim lưu cùng phương án, thay hẳn tập ghim của revision nguồn.
 */
// POST /api/load-plans/{id}/approve (`force`; FastAPI đang có: POST /api/v1/load-plans/{id}/approve) · POST /api/load-plans/{id}/pin · DELETE /api/load-plans/{id}/pin/{placementId}
export async function approveLoadPlan(revisionId: string, patches: readonly PlacementPatch[], options: ApproveOptions = {}): Promise<Revision> {
  return getMockDb().approveRevision(revisionId, patches, options)
}
