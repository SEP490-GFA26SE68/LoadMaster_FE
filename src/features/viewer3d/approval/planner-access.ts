import type { TripPhase } from '@/lib/mock-db'

/**
 * Vì sao Planner chỉ xem: chuyến đã sang pha vận hành (D-45), hoặc tài khoản không có quyền Duyệt (D-41) — chỉ quản lý công ty duyệt
 * (LM-104): bản chưa duyệt là `awaitingApproval` ("chờ quản lý công ty duyệt"), bản đã duyệt là `readOnly`.
 * *(LM-108)* Điều phối viên (chạy tối ưu, không duyệt) được **chỉnh tay** lại: không khoá, nút chính là "Lưu bản chỉnh" khi đã dời / xoay
 * kiện; `awaitingApproval` / `readOnly` chỉ còn cho tài khoản không chỉnh cũng không duyệt.
 */
export type PlannerLock = Exclude<TripPhase, 'planning'> | 'awaitingApproval' | 'readOnly'

export type PlannerAccess = {
  /** `null`: chỉnh sửa và duyệt được. Có lý do thì Planner ẩn Chỉnh sửa, Duyệt và nói lý do một lần. */
  readonly lock: PlannerLock | null
  /** Nút chính: `plan` "Duyệt phương án", `draft` "Duyệt bản chỉnh", `save` "Lưu bản chỉnh" (điều phối, LM-108), `null` không có nút. */
  readonly approve: 'plan' | 'draft' | 'save' | null
  /** Thời điểm duyệt của revision đang xem khi không có chỉnh sửa chưa duyệt: hiện "Đã duyệt lúc …" thay cho nút Duyệt. */
  readonly approvedAt: string | null
  /** Không khoá nhưng vẫn nói một dòng: điều phối viên đang xem bản chưa duyệt, chưa chỉnh gì — "Chờ quản lý công ty duyệt" (LM-108). */
  readonly notice: 'awaitingApproval' | null
}

/**
 * Hành động của Planner (LM-094, D-51). Pha khoá thắng quyền: chuyến đang xếp thì "phương án đã chốt" đúng với mọi vai trò.
 * `hasEdits`: draft có dời hoặc xoay kiện (thứ được gửi khi Duyệt; ghim không tính). `approvedAt`: `null` khi revision chưa duyệt
 * hoặc là fixture benchmark.
 */
export function plannerAccess({ phase = 'planning', canApprove, canEdit = canApprove, approvedAt, hasEdits }: {
  phase?: TripPhase
  canApprove: boolean
  /** Dời / xoay kiện được (LM-108): người duyệt, hoặc điều phối viên (quyền chạy tối ưu). Mặc định theo `canApprove`. */
  canEdit?: boolean
  approvedAt: string | null
  hasEdits: boolean
}): PlannerAccess {
  const lock: PlannerLock | null = phase !== 'planning' ? phase
    : canApprove || canEdit ? null : approvedAt === null ? 'awaitingApproval' : 'readOnly'
  const approve = lock !== null ? null
    : canApprove ? (hasEdits ? 'draft' : approvedAt === null ? 'plan' : null)
      : hasEdits ? 'save' : null
  const notice = lock === null && !canApprove && approvedAt === null && !hasEdits ? 'awaitingApproval' : null
  return { lock, approve, approvedAt: hasEdits ? null : approvedAt, notice }
}
