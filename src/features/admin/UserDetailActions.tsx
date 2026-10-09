import { KeyRound, Lock, LockOpen, Pencil, Trash2, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { User } from '@/types/user'
import { toggleLockBlock, type AccountBlock, type AccountGuards } from './account-guards'
import type { UserAction } from './UserRowMenu'

type ActionItem = {
  readonly action: UserAction
  readonly icon: LucideIcon
  readonly label: string
  readonly block: AccountBlock | null
  readonly danger?: boolean
}

/**
 * Nút thao tác trong panel chi tiết: cùng bốn thao tác, cùng luật chặn (`accountGuards`, `toggleLockBlock`) và cùng đường xử lý
 * (`onAction` → `useUserActions`) với menu ở cuối dòng. Màn đã có nút chính "Thêm người dùng" nên ở đây chỉ nút phụ; xoá là nút
 * ghost chữ đỏ như mục xoá của menu. Nút bị chặn mờ đi, lý do nằm ngay dưới và nối vào nút bằng `aria-describedby`. Quản trị hệ thống
 * xem nhân sự công ty (FE-0-08): Sửa và Xoá mờ, còn Khoá / Mở khoá và Đặt lại mật khẩu.
 */
export function UserDetailActions({ user, guards, onAction }: {
  user: User
  guards: AccountGuards
  onAction: (action: UserAction, user: User) => void
}) {
  const t = useT()
  const reasonId = useId()
  const suspended = user.status === 'suspended'
  const items: ActionItem[] = [
    { action: 'edit', icon: Pencil, label: t('admin.users.menu.edit'), block: guards.edit },
    {
      action: 'toggleLock',
      icon: suspended ? LockOpen : Lock,
      label: suspended ? t('admin.users.menu.unlock') : t('admin.users.menu.lock'),
      block: toggleLockBlock(user, guards),
    },
    { action: 'resetPassword', icon: KeyRound, label: t('admin.users.menu.resetPassword'), block: null },
    { action: 'delete', icon: Trash2, label: t('admin.users.menu.delete'), block: guards.remove, danger: true },
  ]
  // Nhiều nút thường chung một lý do (chính mình; nhân sự công ty) — hiện mỗi lý do một lần, mỗi nút trỏ tới lý do của nó
  const reasons = [...new Set(items.flatMap((item) => (item.block === null ? [] : [item.block])))]

  return (
    <section aria-labelledby={`${reasonId}-title`} className="flex flex-col gap-2">
      <h3 id={`${reasonId}-title`} className="text-body font-semibold text-ink-strong">{t('admin.users.detail.actions')}</h3>
      {items.map(({ action, icon: Icon, label, block, danger }) => (
        <Button
          key={action}
          variant={danger ? 'ghost' : 'secondary'}
          disabled={block !== null}
          aria-describedby={block === null ? undefined : `${reasonId}-${block}`}
          onClick={() => onAction(action, user)}
          className={cn('w-full justify-start', danger && block === null && 'text-danger hover:text-danger-hover')}
        >
          <Icon strokeWidth={1.5} aria-hidden />
          {label}
        </Button>
      ))}
      {reasons.map((reason) => (
        <p key={reason} id={`${reasonId}-${reason}`} className="text-caption text-ink-3">{t(`admin.users.blocked.${reason}`)}</p>
      ))}
    </section>
  )
}
