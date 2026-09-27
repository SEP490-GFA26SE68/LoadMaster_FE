import type { TripPhase } from '@/lib/mock-db'

/**
 * Vì sao Planner chỉ xem: chuyến đã sang pha vận hành (D-45), hoặc tài khoản không có quyền Duyệt (D-41) — chỉ quản lý công ty duyệt
 * (LM-104): bản chưa duyệt là `awaitingApproval` ("chờ quản lý công ty duyệt"), bản đã duyệt là `readOnly`. `decided`: quản lý công
 * ty đã trả lại bản này (từ chối, yêu cầu tối ưu lại, đề xuất) — không ai duyệt hay chỉnh nó nữa, điều phối chạy lại.
 */
export type PlannerLock = Exclude<TripPhase, 'planning'> | 'awaitingApproval' | 'readOnly' | 'decided'

export type PlannerAccess = {
  /** `null`: chỉnh sửa và duyệt được. Có lý do thì Planner ẩn Chỉnh sửa, Duyệt và nói lý do một lần. */
  readonly lock: PlannerLock | null
  /** Nút Duyệt: `plan` "Duyệt phương án", `draft` "Duyệt bản chỉnh", `null` không có nút. */
  readonly approve: 'plan' | 'draft' | null
  /** Thời điểm duyệt của revision đang xem khi không có chỉnh sửa chưa duyệt: hiện "Đã duyệt lúc …" thay cho nút Duyệt. */
  readonly approvedAt: string | null
}

/**
 * Hành động của Planner (LM-094, D-51). Pha khoá thắng quyền: chuyến đang xếp thì "phương án đã chốt" đúng với mọi vai trò; rồi tới
 * quyết định trả lại của quản lý (LM-104), rồi quyền. `hasEdits`: draft có dời hoặc xoay kiện (thứ được gửi khi Duyệt; ghim không
 * tính). `approvedAt`: `null` khi revision chưa duyệt hoặc là fixture benchmark. `decided`: revision đang xem có quyết định trả lại.
 */
export function plannerAccess({ phase = 'planning', canApprove, approvedAt, hasEdits, decided = false }: {
  phase?: TripPhase
  canApprove: boolean
  approvedAt: string | null
  hasEdits: boolean
  decided?: boolean
}): PlannerAccess {
  const lock: PlannerLock | null = phase !== 'planning' ? phase
    : decided ? 'decided'
      : canApprove ? null : approvedAt === null ? 'awaitingApproval' : 'readOnly'
  const approve = lock !== null ? null : hasEdits ? 'draft' : approvedAt === null ? 'plan' : null
  return { lock, approve, approvedAt: hasEdits ? null : approvedAt }
}
