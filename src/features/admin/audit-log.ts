import type { Permission } from '@/features/auth/permissions'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { AuditAction, AuditEvent, AuditTargetType } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { paramLabel, paramValue } from './audit-params'
import { actorInitials } from './audit-look'

/** Tên hiện của đối tượng trong kho lúc đọc nhật ký: mã → tên. Đối tượng đã xoá không có ở đây. */
export type AuditDirectory = {
  readonly users: ReadonlyMap<string, string>
  readonly trips: ReadonlyMap<string, string>
  readonly vehicles: ReadonlyMap<string, string>
  /** Vai trò hiện tại theo mã người dùng — chỉ màn `/nhat-ky` cần (dòng phụ dưới tên người làm); chuông thông báo bỏ trống. */
  readonly roles?: ReadonlyMap<string, Role>
}

/** Một dòng nhật ký đã dịch cho bảng `/nhat-ky` (LM-091). */
export type AuditRow = {
  readonly id: string
  /** ISO 8601, giữ nguyên để sắp xếp; ô bảng format theo ngôn ngữ. */
  readonly at: string
  readonly actorId: string | null
  readonly actor: string
  readonly action: string
  /**
   * `label` vắng khi kho không còn tên (email lạ khi đăng nhập sai); `href` vắng khi đối tượng không còn trang để mở, hoặc người xem
   * không có quyền mở trang đó (FE-0-03: quản trị hệ thống và quản trị công ty đọc nhật ký nhưng không xem được chuyến, xe).
   */
  readonly target: { readonly id: string; readonly label: string | null; readonly href: string | null }
  readonly details: string
}

/** Dòng của bảng `/nhat-ky` (V2): thêm mã hành động (icon + tint) và ô đại diện của người làm. */
export type AuditLogRow = AuditRow & {
  readonly actionCode: AuditAction
  /** Vắng khi người làm không còn là một tài khoản trong kho (hệ thống, chưa đăng nhập, đã xoá). */
  readonly actorInitials: string | null
  /** Vai trò **hiện tại** của người làm, đã dịch; vắng khi kho không trả vai trò. */
  readonly actorRole: string | null
}

/** Quyền mở trang của từng loại đối tượng — cùng nhóm quyền với route của trang đó trong `App.tsx`; `null` khi loại đó không có trang. */
const TARGET_PERMISSION: Readonly<Record<AuditTargetType, Permission | null>> = {
  trip: 'trips.view',
  vehicle: 'fleet.view',
  user: 'users.manage',
  revision: null,
  packageType: 'packages.manage',
  package: 'packages.view',
  requirement: 'requirements.view',
  vehicleType: 'fleet.view',
  // Gói cước và credit của công ty mở màn gói cước của chính công ty đó (FE-8-03): chỉ quản trị công ty (`billing.manage`)
  company: 'billing.manage',
  // Yêu cầu hỗ trợ mở ở màn của Hỗ trợ khách hàng (FE-8-07); người gửi không có trang riêng (hộp thoại ở menu tài khoản)
  ticket: 'support.handle',
  // Yêu cầu liên hệ của khách mở ở màn `/lien-he-khach` của ba vai trò nền tảng
  contact: 'contacts.handle',
}

/** `can(permission)` của người xem (`useCan`): đối tượng chỉ thành liên kết khi người xem mở được trang đích. */
export type CanOpen = (permission: Permission) => boolean

/**
 * Đọc một sự kiện nhật ký (D-43) bằng ngôn ngữ đang chọn: người làm, hành động (`audit.actions.*`), đối tượng (tên hiện tại, liên kết
 * nếu còn trang và người xem có quyền mở trang đó), chi tiết (tham số đã dịch và format). Hàm thuần: `directory` do `audit-api.ts`
 * đọc từ kho, `can` là quyền của người xem.
 */
export function describeEvent(event: AuditEvent, directory: AuditDirectory, t: TFunction, format: Formatter, can: CanOpen): AuditRow {
  return {
    id: event.id,
    at: event.at,
    actorId: event.actorId,
    actor: actorLabel(event, directory, t),
    action: t(`audit.actions.${event.action}`),
    target: targetOf(event, directory, can),
    details: Object.entries(event.params)
      .map(([key, value]) => t('audit.log.detail', { label: paramLabel(key, t), value: paramValue(event, key, value, directory, t, format) }))
      .join(' · '),
  }
}

/** Một dòng của bảng `/nhat-ky`: `describeEvent` cộng những gì chỉ bảng cần. Hàm thuần như `describeEvent`. */
export function describeLogRow(event: AuditEvent, directory: AuditDirectory, t: TFunction, format: Formatter, can: CanOpen): AuditLogRow {
  const name = event.actorId === null ? undefined : directory.users.get(event.actorId)
  const role = event.actorId === null ? undefined : directory.roles?.get(event.actorId)
  return {
    ...describeEvent(event, directory, t, format, can),
    actionCode: event.action,
    actorInitials: name === undefined ? null : actorInitials(name),
    actorRole: role === undefined ? null : t(`roles.${role}`),
  }
}

/** Việc người chưa đăng nhập làm: đăng nhập sai, khách gửi yêu cầu liên hệ ở trang giới thiệu. Sự kiện khác không có người làm là của hệ thống. */
const ANONYMOUS_ACTIONS: ReadonlySet<AuditEvent['action']> = new Set(['auth.signInFailed', 'contact.received'])

function actorLabel({ actorId, action }: AuditEvent, directory: AuditDirectory, t: TFunction): string {
  if (actorId === null) return ANONYMOUS_ACTIONS.has(action) ? t('audit.log.anonymous') : t('audit.log.system')
  return directory.users.get(actorId) ?? t('audit.log.deletedUser', { id: actorId })
}

/** Đối tượng của sự kiện; liên kết chỉ giữ khi người xem có quyền mở trang đích — không thì tên hiện dạng chữ thường. */
function targetOf(event: AuditEvent, directory: AuditDirectory, can: CanOpen): AuditRow['target'] {
  const target = linkedTarget(event, directory)
  const permission = TARGET_PERMISSION[event.target.type]
  return target.href !== null && permission !== null && can(permission) ? target : { ...target, href: null }
}

function linkedTarget({ target, params }: AuditEvent, directory: AuditDirectory): AuditRow['target'] {
  const saved = typeof params.name === 'string' ? params.name : typeof params.fullName === 'string' ? params.fullName : null
  const id = target.id
  switch (target.type) {
    case 'trip': {
      const name = directory.trips.get(id)
      return { id, label: name ?? saved, href: name === undefined ? null : `/chuyen/${encodeURIComponent(id)}` }
    }
    case 'vehicle': {
      const name = directory.vehicles.get(id)
      return { id, label: name ?? saved, href: name === undefined ? null : `/doi-xe/${encodeURIComponent(id)}` }
    }
    case 'user': {
      const name = directory.users.get(id)
      // Người dùng chưa có trang riêng: mở danh sách lọc đúng mã đó
      return { id, label: name ?? saved, href: name === undefined ? null : `/nguoi-dung?q=${encodeURIComponent(id)}` }
    }
    case 'revision':
      return { id, label: null, href: null }
    // Review 1 (LM-104): mở màn danh sách / chi tiết của đối tượng
    case 'packageType':
      return { id, label: saved, href: '/loai-kien' }
    case 'package':
      return { id, label: saved, href: `/kien-hang?q=${encodeURIComponent(id)}` }
    case 'requirement':
      // Yêu cầu đã xoá vẫn đọc được tên điểm đến từ tham số của sự kiện; liên kết mở danh sách lọc đúng mã (rỗng nếu đã xoá)
      return { id, label: typeof params.destinationName === 'string' ? params.destinationName : saved, href: `/yeu-cau-giao?q=${encodeURIComponent(id)}` }
    case 'vehicleType':
      return { id, label: saved, href: '/doi-xe/loai-xe' }
    case 'company':
      return { id, label: saved, href: '/goi-cuoc' }
    case 'ticket':
      return { id, label: saved, href: `/ho-tro?ticket=${encodeURIComponent(id)}` }
    case 'contact':
      return { id, label: saved, href: `/lien-he-khach?lien-he=${encodeURIComponent(id)}` }
  }
}
