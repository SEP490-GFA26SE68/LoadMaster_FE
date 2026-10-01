import { LogOut, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { initialsOf } from '@/types/user'
import { useAuth } from './AuthProvider'

/** Mục menu cỡ cảm ứng: cao 56px, chữ 16px, icon 20px (mục 10). */
const TOUCH_ITEM = 'h-14 px-3 text-body-lg [&_svg]:size-5'

/**
 * Nút tài khoản 56px ở header màn chính của kho (`/kho`) và tài xế (`/tai-xe`) — hai màn không có nav rail (LM-096): mở hồ sơ cá
 * nhân hoặc đăng xuất. Cùng nhãn "Tài khoản {tên}" với menu tài khoản của nav rail.
 */
export function AccountMenu({ className }: { className?: string }) {
  const t = useT()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  async function handleSignOut() {
    await signOut()
    void navigate('/dang-nhap', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.account', { name: user.fullName })}
        className={cn(
          'grid size-14 flex-none place-items-center rounded-md outline-none transition-colors duration-(--dur-fast) ease-standard',
          'hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          className,
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-primary-bg text-body-lg font-semibold leading-none text-primary-hover">
          {initialsOf(user.fullName)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-32px)]">
        <DropdownMenuLabel className="px-3 text-body-lg">
          <span className="font-medium text-text">{user.fullName}</span>
          <span className="break-all text-text-3">{user.email}</span>
          {/* Kho là tuỳ chọn (người dùng nền tảng không có): không có thì chỉ còn tên vai trò, không để dấu chấm treo */}
          <span className="text-text-3">{[t(`roles.${user.role}`), user.depot].filter(Boolean).join(' · ')}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={TOUCH_ITEM}>
          <Link to="/ho-so">
            <UserRound strokeWidth={1.5} aria-hidden />
            {t('nav.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className={TOUCH_ITEM} onSelect={() => void handleSignOut()}>
          <LogOut strokeWidth={1.5} aria-hidden />
          {t('nav.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
