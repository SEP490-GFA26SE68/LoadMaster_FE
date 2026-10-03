import type { Role } from '@/types/user'

/**
 * Nhật ký sự kiện của kho (D-43). Kho chỉ lưu **mã** hành động và tham số, không lưu câu: màn `/nhat-ky` dịch bằng nhánh `audit`
 * của từ điển. Thêm mã ở đây mà chưa có câu thì `tsc -b` báo lỗi ở từ điển.
 */
export const AUDIT_ACTIONS = [
  'auth.signedIn',
  'auth.signedOut',
  'auth.signInFailed',
  'vehicle.created',
  'vehicle.updated',
  'vehicle.deleted',
  'vehicle.maintenanceOn',
  'vehicle.maintenanceOff',
  'trip.created',
  'trip.updated',
  'trip.cancelled',
  // Kiện kho kiện đưa thẳng vào chuyến (FE-4b-05)
  'trip.packagesAdded',
  'trip.packageRemoved',
  // Vượt luật phân tách hàng (FE-4b-06), tối ưu tuyến (FE-4b-09)
  'trip.segregationOverridden',
  'trip.routeOptimized',
  // Đổi xe của chuyến Đã lập kế hoạch (FE-5b-08)
  'trip.vehicleChanged',
  // Điều phối viên chọn tuyến thay thế khi có sự cố (FE-6-11, sự kiện `TRIP_REROUTED` của backend)
  'trip.rerouted',
  'optimization.saved',
  'revision.approved',
  'loading.started',
  'loading.missing',
  'loading.completed',
  'delivery.started',
  'delivery.issue',
  'delivery.stopCompleted',
  'delivery.completed',
  // Mức hạn của một điểm xấu đi theo vị trí xe (FE-6-09, sự kiện `ETA_RISK` của backend) — hệ thống ghi, không có người làm
  'delivery.etaRisk',
  'user.created',
  'user.updated',
  'user.locked',
  'user.unlocked',
  'user.deleted',
  'user.passwordReset',
  'user.passwordChanged',
  'user.profileUpdated',
  // Review 1 (LM-104)
  'packageType.created',
  'packageType.updated',
  'packageType.deleted',
  'package.created',
  'package.importConfirmed',
  'package.updated',
  'package.statusChanged',
  'package.flagged',
  'package.flagCleared',
  'package.found',
  // Yêu cầu giao (FE-4b-01) — thay nhóm `order` của Review 1
  'requirement.created',
  'requirement.updated',
  'requirement.deleted',
  'requirement.assigned',
  'requirement.unassigned',
  'optimization.failed',
  'vehicleType.created',
  'vehicleType.updated',
  'vehicleType.deleted',
  'vehicleType.assigned',
  'loading.sealed',
  // Xác nhận tay của đối chiếu kiện và việc duyệt của điều phối viên (FE-6-03, FE-6-04)
  'manualConfirm.requested',
  'manualConfirm.approved',
  'manualConfirm.rejected',
  // Sự cố cấp chuyến (FE-6-11) và gia hạn của quản lý công ty (FE-6-12); `escalated` do hệ thống ghi khi quá 30 phút chưa xử lý
  'exception.reported',
  'exception.escalated',
  'exception.resolved',
  'exception.deadlineRenegotiated',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/** Nhóm hành động cho bộ lọc: phần trước dấu chấm của mã. */
export type AuditGroup = AuditAction extends `${infer Group}.${string}` ? Group : never

export const AUDIT_GROUPS = [...new Set(AUDIT_ACTIONS.map((action) => action.split('.')[0]))] as AuditGroup[]

export type AuditTargetType =
  | 'trip'
  | 'vehicle'
  | 'user'
  | 'revision'
  // LM-104
  | 'packageType'
  | 'package'
  | 'requirement'
  | 'vehicleType'

export type AuditEvent = {
  /** `EV-NNNNNN`, tăng theo thứ tự ghi. */
  id: string
  /** ISO 8601 */
  at: string
  /** Người làm; `null` khi hệ thống (hoặc đăng nhập sai, chưa có phiên). */
  actorId: string | null
  /**
   * Công ty của phiên đã ghi sự kiện (D-64); `null` khi người làm là tài khoản nền tảng, hoặc lần đăng nhập sai không khớp tài khoản
   * của công ty nào. Người của công ty chỉ đọc được sự kiện của công ty mình.
   */
  companyId: string | null
  action: AuditAction
  target: { type: AuditTargetType; id: string }
  /** Tham số để dịch câu: mã, số, lý do người dùng nhập. Không chứa câu hiển thị của hệ thống. */
  params: Readonly<Record<string, string | number>>
}

/**
 * Tên hiện tại của người dùng, chuyến và xe trong phạm vi nhật ký của người gọi (`listAuditNames`): đủ để đọc người làm và đối tượng
 * của sự kiện mà không cần quyền xem dữ liệu vận hành.
 */
export type AuditNames = {
  users: { id: string; fullName: string; role: Role }[]
  trips: { id: string; name: string }[]
  vehicles: { id: string; name: string }[]
}

export function auditGroup(action: AuditAction): AuditGroup {
  return action.split('.')[0] as AuditGroup
}

/** Cây nhãn cho từ điển: `nhóm.hành động` → câu, để `t(\`audit.actions.${action}\`)` tra đúng một câu và thiếu mã là lỗi kiểu. */
export type AuditActionLabels = {
  readonly [Group in AuditGroup]: {
    readonly [Action in Extract<AuditAction, `${Group}.${string}`> as Action extends `${Group}.${infer Key}` ? Key : never]: string
  }
}
