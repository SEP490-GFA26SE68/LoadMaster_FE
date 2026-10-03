import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Container,
  KeyRound,
  MapPin,
  Package,
  QrCode,
  Route,
  Shapes,
  Truck,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type { KpiTone } from '@/components/KpiTile'
import { auditGroup, type AuditAction, type AuditGroup } from '@/lib/mock-db'

/** Icon nói hành động thuộc việc gì: một icon cho mỗi nhóm của bộ lọc "Nhóm hành động". */
const GROUP_ICON: Record<AuditGroup, LucideIcon> = {
  auth: KeyRound,
  vehicle: Truck,
  trip: Route,
  optimization: Boxes,
  revision: ClipboardCheck,
  loading: Package,
  delivery: MapPin,
  user: UserRound,
  packageType: Shapes,
  package: QrCode,
  requirement: ClipboardList,
  vehicleType: Container,
}

/**
 * Tint nói hành động có nghĩa gì, theo nghĩa cố định của AGENTS mục 4 — không mượn màu của nhóm: xanh dương = việc vận hành,
 * xanh lá = xong / sẵn sàng, hổ phách = cần người xem lại, xanh lam = kết quả phân tích (tối ưu), xám = ngữ cảnh (phiên, tài khoản,
 * xoá bản ghi). Khai theo từng mã nên thêm mã vào kho mà chưa chọn tint là lỗi kiểu.
 */
const ACTION_TONE: Record<AuditAction, KpiTone> = {
  'auth.signedIn': 'slate',
  'auth.signedOut': 'slate',
  'auth.signInFailed': 'amber',
  'vehicle.created': 'blue',
  'vehicle.updated': 'blue',
  'vehicle.deleted': 'slate',
  'vehicle.maintenanceOn': 'amber',
  'vehicle.maintenanceOff': 'green',
  'trip.created': 'blue',
  'trip.updated': 'blue',
  'trip.cancelled': 'amber',
  'trip.packagesAdded': 'blue',
  'trip.packageRemoved': 'amber',
  'trip.segregationOverridden': 'amber',
  'trip.routeOptimized': 'azure',
  'trip.vehicleChanged': 'blue',
  'optimization.saved': 'azure',
  'revision.approved': 'green',
  'loading.started': 'blue',
  'loading.missing': 'amber',
  'loading.completed': 'green',
  'delivery.started': 'blue',
  'delivery.issue': 'amber',
  'delivery.stopCompleted': 'green',
  'delivery.completed': 'green',
  'user.created': 'slate',
  'user.updated': 'slate',
  'user.locked': 'amber',
  'user.unlocked': 'slate',
  'user.deleted': 'slate',
  'user.passwordReset': 'slate',
  'user.passwordChanged': 'slate',
  'user.profileUpdated': 'slate',
  'packageType.created': 'blue',
  'packageType.updated': 'blue',
  'packageType.deleted': 'slate',
  'package.created': 'blue',
  'package.importConfirmed': 'blue',
  'package.updated': 'blue',
  'package.statusChanged': 'blue',
  'package.flagged': 'amber',
  'package.flagCleared': 'slate',
  'package.found': 'green',
  'requirement.created': 'blue',
  'requirement.updated': 'blue',
  'requirement.deleted': 'amber',
  'requirement.assigned': 'blue',
  'requirement.unassigned': 'amber',
  'optimization.failed': 'amber',
  'vehicleType.created': 'blue',
  'vehicleType.updated': 'blue',
  'vehicleType.deleted': 'slate',
  'vehicleType.assigned': 'blue',
  'loading.sealed': 'green',
}

/** Icon (theo nhóm) và tint (theo nghĩa) của một mã hành động nhật ký. */
export function auditActionLook(action: AuditAction): { icon: LucideIcon; tone: KpiTone } {
  return { icon: GROUP_ICON[auditGroup(action)], tone: ACTION_TONE[action] }
}

/**
 * Chữ tắt trên ô đại diện của người làm: chữ đầu của hai tiếng cuối (tên đệm + tên — tên người Việt đứng cuối), viết hoa, giữ dấu.
 * Chuẩn hoá NFC trước để chữ có dấu rời vẫn là một ký tự.
 */
export function actorInitials(fullName: string): string {
  const words = fullName.normalize('NFC').trim().split(/\s+/).filter((word) => word !== '')
  return words.slice(-2).map((word) => [...word][0] ?? '').join('').toLocaleUpperCase('vi')
}
