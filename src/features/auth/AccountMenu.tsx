import { LifeBuoy, LogOut, UserRound } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
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
import { can } from './permissions'

/** Hộp thoại yêu cầu hỗ trợ (FE-8-07) tải khi mở lần đầu. */
const SupportTicketDialog = lazy(() => import('@/features/support/SupportTicketDialog').then((m) => ({ default: m.SupportTicketDialog })))

/** Mục menu cỡ cảm ứng: cao 56px, chữ 16px, icon 20px (mục 10). */
const TOUCH_ITEM = 'h-14 px-3 text-body-lg [&_svg]:size-5'

/**
 * Nút tài khoản 56px ở header màn chính của kho (`/kho`) và tài xế (`/tai-xe`) — hai màn không có nav rail (LM-096): mở hồ sơ cá
 * nhân, yêu cầu hỗ trợ (FE-8-07) hoặc đăng xuất. Cùng nhãn "Tài khoản {tên}" với menu tài khoản của nav rail.
 */
export function AccountMenu({ className, tone = 'light' }: {
  className?: string
  /** `sky`: nút trên dải trời của kho (V2.3 đợt 6) — ảnh đại diện cyan, vòng focus sáng. */
  tone?: 'light' | 'sky'
}) {
  const t = useT()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [supportOpen, setSupportOpen] = useState(false)
  if (!user) return null

  async function handleSignOut() {
    await signOut()
    void navigate('/dang-nhap', { replace: true })
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label={t('nav.account', { name: user.fullName })}
          className={cn(
            'grid size-14 flex-none place-items-center rounded-md outline-none transition-colors duration-(--dur-fast) ease-standard',
            'focus-visible:outline-2 focus-visible:outline-offset-2',
            tone === 'sky' ? 'hover:bg-sky-solid-hover focus-visible:outline-cyan-300' : 'hover:bg-surface focus-visible:outline-primary',
            className,
          )}
        >
          <span
            className={cn(
              'grid size-11 place-items-center rounded-full text-body-lg font-semibold leading-none',
              tone === 'sky' ? 'bg-(image:--avatar-fill) text-cyan-950' : 'bg-primary-bg text-primary-hover',
            )}
          >
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
          {can(user.role, 'support.create') ? (
            <DropdownMenuItem className={TOUCH_ITEM} onSelect={() => setSupportOpen(true)}>
              <LifeBuoy strokeWidth={1.5} aria-hidden />
              {t('nav.supportRequests')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className={TOUCH_ITEM} onSelect={() => void handleSignOut()}>
            <LogOut strokeWidth={1.5} aria-hidden />
            {t('nav.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {supportOpen ? (
        <Suspense fallback={null}>
          <SupportTicketDialog onClose={() => setSupportOpen(false)} />
        </Suspense>
      ) : null}
    </>
  )
}
