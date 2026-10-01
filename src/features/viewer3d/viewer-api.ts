import type { PlacementPatch } from '@/domain/constraints'
import { getMockDb, type Revision, type Trip } from '@/lib/mock-db'

export type PlanSource = { readonly trip: Trip; readonly revision: Revision }

/**
 * Lớp dữ liệu của Planner (LM-030): nơi duy nhất trong `viewer3d` biết về kho. Nối backend thật chỉ thay thân hàm.
 *
 * Chọn revision: `ref` là mã revision thì lấy đúng bản đó; là `jobId` thì lấy revision mới nhất của job (bản đã duyệt dùng chung
 * `jobId` với bản nguồn nên bản đã duyệt thắng — Tối ưu mở bằng `jobId`, Duyệt và So sánh mở bằng mã revision); không có thì lấy revision đã duyệt mới nhất, rồi tới revision mới nhất. Chuyến chưa có revision nào
 * trả `revision: undefined` để màn hiện trạng thái rỗng thay vì phương án giả.
 */
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
}

/** Ai đã duyệt revision: kho ghi người bấm Duyệt vào revision đã duyệt (`approvedBy`), tên lấy từ danh sách người dùng. */
export async function fetchPlanApproval(revisionId: string): Promise<PlanApproval> {
  const db = getMockDb()
  const [revision, users] = await Promise.all([db.getRevision(revisionId), db.listUsers()])
  const approverId = revision.approvedAt === undefined ? null : (revision.approvedBy ?? null)
  return { approvedByName: users.find((user) => user.id === approverId)?.fullName ?? null }
}

/** Duyệt (LM-050, D-31): kho tạo revision approved mới từ revision đang xem và patch của draft; revision nguồn giữ nguyên. */
export async function approvePlanRevision(revisionId: string, patches: readonly PlacementPatch[]): Promise<Revision> {
  return getMockDb().approveRevision(revisionId, patches)
}

/** Lưu bản chỉnh tay chưa duyệt (LM-108): bản đã dời / xoay kiện của điều phối viên thành revision mới chờ quản lý công ty duyệt. */
export async function saveEditedPlanRevision(revisionId: string, patches: readonly PlacementPatch[]): Promise<Revision> {
  return getMockDb().saveEditedRevision(revisionId, patches)
}
