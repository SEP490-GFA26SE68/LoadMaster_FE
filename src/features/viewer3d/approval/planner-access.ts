import type { TripPhase } from '@/lib/mock-db'

/**
 * Vì sao Planner chỉ xem: chuyến đã sang pha vận hành (D-45), hoặc tài khoản không có quyền chỉnh sửa và duyệt phương án (D-41,
 * `plans.approve`) — từ FE-0-07 (D-80) quyền đó là của điều phối viên, quản lý công ty xem chỉ đọc (`readOnly`).
 */
export type PlannerLock = Exclude<TripPhase, 'planning'> | 'readOnly'

export type PlannerAccess = {
  /** `null`: chỉnh sửa và duyệt được. Có lý do thì Planner ẩn Chỉnh sửa, Duyệt và nói lý do một lần. */
  readonly lock: PlannerLock | null
  /** Nút Duyệt cần hiện: `plan` "Duyệt phương án", `draft` "Duyệt bản chỉnh" (đã dời, xoay hoặc ghim kiện), `null` không có nút. */
  readonly approve: 'plan' | 'draft' | null
  /** Thời điểm duyệt của revision đang xem khi không có chỉnh sửa chưa duyệt: hiện "Đã duyệt lúc …" thay cho nút Duyệt. */
  readonly approvedAt: string | null
}

/**
 * Hành động của Planner (LM-094, D-51). Pha khoá thắng quyền: chuyến đang xếp thì "phương án đã chốt" đúng với mọi vai trò.
 * `canApprove`: tài khoản chỉnh tay và duyệt được (`plans.approve`). `hasEdits`: draft có dời, xoay hoặc ghim kiện (thứ được gửi khi
 * Duyệt). `approvedAt`: `null` khi revision chưa duyệt hoặc là fixture benchmark.
 */
export function plannerAccess({ phase = 'planning', canApprove, approvedAt, hasEdits }: {
  phase?: TripPhase
  canApprove: boolean
  approvedAt: string | null
  hasEdits: boolean
}): PlannerAccess {
  const lock: PlannerLock | null = phase !== 'planning' ? phase : canApprove ? null : 'readOnly'
  const approve = lock !== null ? null : hasEdits ? 'draft' : approvedAt === null ? 'plan' : null
  return { lock, approve, approvedAt: hasEdits ? null : approvedAt }
}
