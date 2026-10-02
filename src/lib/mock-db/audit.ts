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
  'optimization.saved',
  'revision.approved',
  'loading.started',
  'loading.missing',
  'loading.completed',
  'delivery.started',
  'delivery.issue',
  'delivery.stopCompleted',
  'delivery.completed',
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
  'package.registered',
  'order.created',
  'order.updated',
  'order.cancelled',
  'order.assigned',
  'order.unassigned',
  'optimization.failed',
  'vehicleType.created',
  'vehicleType.updated',
  'vehicleType.deleted',
  'vehicleType.assigned',
  'loading.sealed',
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
  | 'order'
  | 'vehicleType'

export type AuditEvent = {
  /** `EV-NNNNNN`, tăng theo thứ tự ghi. */
  id: string
  /** ISO 8601 */
  at: string
  /** Người làm; `null` khi hệ thống (hoặc đăng nhập sai, chưa có phiên). */
  actorId: string | null
  action: AuditAction
  target: { type: AuditTargetType; id: string }
  /** Tham số để dịch câu: mã, số, lý do người dùng nhập. Không chứa câu hiển thị của hệ thống. */
  params: Readonly<Record<string, string | number>>
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
