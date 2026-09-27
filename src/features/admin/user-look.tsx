import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { initialsOf, type Role, type UserStatus } from '@/types/user'

/** Tint của ô chữ viết tắt — cùng nghĩa với ô số liệu của trạng thái đó (AGENTS mục 4, V2). */
const THUMB: Record<UserStatus, string> = {
  active: 'bg-tint-blue text-tint-blue-fg',
  suspended: 'bg-tint-amber text-tint-amber-fg',
}

/** Chip trạng thái theo ngữ pháp chấm V2.3 (Main.jpg): đang hoạt động chấm xanh lá; đã khoá chip xám chấm xám — khoá là một trạng
 * thái của tài khoản, không phải cảnh báo. */
const STATUS_BADGE: Record<UserStatus, { tone: 'success' | 'neutral'; dot: true }> = {
  active: { tone: 'success', dot: true },
  suspended: { tone: 'neutral', dot: true },
}

/**
 * Ô chữ viết tắt của người dùng: vuông bo góc (không tròn — quyết định V2), tô theo trạng thái. Trang trí: tên đầy đủ luôn nằm
 * ngay bên cạnh nên ô ẩn khỏi trình đọc màn hình. `lg` cho đầu panel chi tiết.
 */
export function UserAvatar({ fullName, status, size = 'md' }: { fullName: string; status: UserStatus; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid flex-none place-items-center rounded-lg font-semibold leading-none',
        size === 'lg' ? 'size-12 text-body' : 'size-9 text-caption',
        THUMB[status],
      )}
    >
      {initialsOf(fullName)}
    </span>
  )
}

/** Vai trò là nhãn ngữ cảnh, không phải trạng thái: nền slate, bo 6 px (không phải viên thuốc — không bấm được, không phải badge). */
export function RoleLabel({ role }: { role: Role }) {
  const t = useT()
  return (
    <span className="inline-flex min-h-5.5 items-center rounded-sm bg-tint-slate px-2 text-caption font-medium text-tint-slate-fg">
      {t(`roles.${role}`)}
    </span>
  )
}

/** Hoạt động gần nhất: giờ + ngày mono, hoặc "Chưa đăng nhập" khi tài khoản chưa vào lần nào. */
export function LastActive({ value }: { value: string | null }) {
  const t = useT()
  const format = useFormat()
  return value ? (
    <span className="font-mono text-caption text-ink-1">{`${format.time(value)} ${format.date(value)}`}</span>
  ) : (
    <span className="text-caption text-ink-3">{t('admin.users.neverSignedIn')}</span>
  )
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const t = useT()
  const badge = STATUS_BADGE[status]
  return <Badge tone={badge.tone} dot={badge.dot}>{t(`admin.users.status.${status}`)}</Badge>
}
