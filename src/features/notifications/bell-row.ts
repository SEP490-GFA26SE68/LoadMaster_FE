import { Ban, Flag, PackageCheck, PackageX, Timer, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { KpiTone } from '@/components/KpiTile'
import type { AuditLogRow } from '@/features/admin/audit-log'
import { auditActionLook } from '@/features/admin/audit-look'
import type { AuditAction } from '@/lib/mock-db'

/**
 * Một dòng của chuông, chữ đã dịch — dựng từ sự kiện của kho mẫu (`mockBellRow`) hoặc từ thông báo của máy chủ (`serverBellRows`).
 * `target.href` vắng khi đối tượng không có trang người xem mở được, hoặc trang đó đọc nguồn khác.
 */
export type BellRow = {
  readonly id: string
  readonly at: string
  readonly action: string
  readonly icon: LucideIcon
  readonly tone: KpiTone
  readonly target: { readonly id: string; readonly label: string | null; readonly href: string | null }
  readonly actor: string
  readonly details: string
}

/**
 * Sự kiện vận hành mà chuông báo cho điều phối và quản lý có icon riêng, rõ hơn icon nhóm của nhật ký (MenuToanCuc V2.3). "Xếp xong"
 * tông xanh lam: "đã xếp xong" là việc đang chạy, như chip trạng thái. Sự kiện khác (duyệt phương án, tài khoản của quản trị viên) theo
 * icon và tint của bảng nhật ký.
 */
const OPERATION_LOOK: Partial<Record<AuditAction, { icon: LucideIcon; tone: KpiTone }>> = {
  'loading.completed': { icon: PackageCheck, tone: 'azure' },
  'loading.shortageReported': { icon: PackageX, tone: 'amber' },
  'loading.shortageDropped': { icon: PackageX, tone: 'amber' },
  'loading.damaged': { icon: PackageX, tone: 'amber' },
  'delivery.issue': { icon: TriangleAlert, tone: 'amber' },
  'delivery.etaRisk': { icon: Timer, tone: 'amber' },
  'delivery.completed': { icon: Flag, tone: 'green' },
  'trip.cancelled': { icon: Ban, tone: 'amber' },
}

/** Cùng việc ở máy chủ (`actionType`) mang cùng icon với kho mẫu. */
export const SERVER_OPERATION_LOOK: Readonly<Record<string, { icon: LucideIcon; tone: KpiTone }>> = {
  LOADING_COMPLETED: { icon: PackageCheck, tone: 'azure' },
  STAGING_SHORTAGE_REPORTED: { icon: PackageX, tone: 'amber' },
  LOADING_DAMAGE_REPORTED: { icon: PackageX, tone: 'amber' },
  DELIVERY_ISSUE_REPORTED: { icon: TriangleAlert, tone: 'amber' },
  DELIVERY_ETA_RISK: { icon: Timer, tone: 'amber' },
  TRIP_COMPLETED: { icon: Flag, tone: 'green' },
  TRIP_CANCELLED: { icon: Ban, tone: 'amber' },
}

export function mockBellRow(row: AuditLogRow): BellRow {
  const { icon, tone } = OPERATION_LOOK[row.actionCode] ?? auditActionLook(row.actionCode)
  return { id: row.id, at: row.at, action: row.action, icon, tone, target: row.target, actor: row.actor, details: row.details }
}
