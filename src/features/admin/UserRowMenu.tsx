import { KeyRound, Lock, LockOpen, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { User } from '@/types/user'
import { toggleLockBlock, type AccountBlock, type AccountGuards } from './account-guards'

export type UserAction = 'edit' | 'toggleLock' | 'resetPassword' | 'delete'

function stopPropagation(event: { stopPropagation: () => void }) {
  event.stopPropagation()
}

/**
 * Menu thao tác ở cuối mỗi dòng người dùng (LM-092): Sửa, Khoá/Mở khoá, Đặt lại mật khẩu, Xoá. Thao tác kho sẽ từ chối (tự khoá/xoá
 * mình, người quản trị cuối cùng, quản trị hệ thống sửa/xoá nhân sự công ty — FE-0-08) hiện mờ, không bấm được, kèm lý do ngay dưới —
 * không để người dùng bấm rồi mới báo lỗi.
 */
export function UserRowMenu({ user, guards, onAction }: {
  user: User
  guards: AccountGuards
  onAction: (action: UserAction, user: User) => void
}) {
  const t = useT()
  const suspended = user.status === 'suspended'
  const lockBlock = toggleLockBlock(user, guards)

  // Bấm dòng mở panel chi tiết: nút menu và các mục của nó (portal, nhưng sự kiện React vẫn nổi theo cây) không được nổi lên dòng.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('admin.users.menu.open', { name: user.fullName })} onClick={stopPropagation}>
          <MoreHorizontal strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" onClick={stopPropagation}>
        <MenuAction
          icon={<Pencil strokeWidth={1.5} aria-hidden />}
          label={t('admin.users.menu.edit')}
          block={guards.edit}
          onSelect={() => onAction('edit', user)}
        />
        <MenuAction
          icon={suspended ? <LockOpen strokeWidth={1.5} aria-hidden /> : <Lock strokeWidth={1.5} aria-hidden />}
          label={suspended ? t('admin.users.menu.unlock') : t('admin.users.menu.lock')}
          block={lockBlock}
          onSelect={() => onAction('toggleLock', user)}
        />
        <DropdownMenuItem onSelect={() => onAction('resetPassword', user)}>
          <KeyRound strokeWidth={1.5} aria-hidden />
          {t('admin.users.menu.resetPassword')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <MenuAction
          icon={<Trash2 strokeWidth={1.5} aria-hidden />}
          label={t('admin.users.menu.delete')}
          block={guards.remove}
          danger
          onSelect={() => onAction('delete', user)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Mục có thể bị chặn: chặn thì mờ đi (Radix `disabled`, bàn phím bỏ qua) và dòng lý do nằm ngay dưới nhãn. */
function MenuAction({ icon, label, block, danger = false, onSelect }: {
  icon: ReactNode
  label: string
  block: AccountBlock | null
  danger?: boolean
  onSelect: () => void
}) {
  const t = useT()
  return (
    <DropdownMenuItem
      disabled={block !== null}
      onSelect={onSelect}
      className={cn(block !== null && 'h-auto items-start py-1.5', danger && block === null && 'text-danger [&_svg]:text-danger')}
    >
      {icon}
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {/* Mục menu không xuống dòng; lý do dài hơn bề rộng menu thì xuống dòng, không bị cắt ở mép phải */}
        {block !== null ? <span className="text-caption whitespace-normal text-text-3">{t(`admin.users.blocked.${block}`)}</span> : null}
      </span>
    </DropdownMenuItem>
  )
}
