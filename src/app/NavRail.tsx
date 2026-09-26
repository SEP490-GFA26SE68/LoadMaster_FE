import { Box, LayoutDashboard, LogOut, ScrollText, Tablet, Truck, UserRound, Users, Warehouse } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router'
import { LanguageMenu } from '@/components/LanguageMenu'
import { Badge } from '@/components/ui/Badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Permission } from '@/features/auth/permissions'
import { useCan } from '@/features/auth/useCan'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { QuickSearch } from '@/features/search/QuickSearch'
import { useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { initialsOf } from '@/types/user'
import { BrandMark } from './BrandMark'

type NavItem = {
  to: string
  labelKey: MessageKey
  icon: LucideIcon
  /** Mục chỉ hiện khi người đăng nhập có quyền mở màn đích (D-41). */
  permission: Permission
}

/** Thứ tự và nhãn lấy từ thanh điều hướng trong bản design. */
const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { to: '/chuyen', labelKey: 'nav.trips', icon: Truck, permission: 'trips.view' },
  { to: '/kho', labelKey: 'nav.warehouse', icon: Tablet, permission: 'warehouse.operate' },
  { to: '/tai-xe', labelKey: 'nav.driver', icon: Box, permission: 'driver.operate' },
  { to: '/doi-xe', labelKey: 'nav.fleet', icon: Warehouse, permission: 'fleet.view' },
  { to: '/nguoi-dung', labelKey: 'nav.users', icon: Users, permission: 'users.manage' },
  { to: '/nhat-ky', labelKey: 'nav.audit', icon: ScrollText, permission: 'audit.view' },
] as const satisfies readonly NavItem[]

/** Ảnh đại diện chữ tắt tròn, gradient cyan (V2.3 `.avatar`) — chỉ ở thanh điều hướng và menu tài khoản (AGENTS mục 5). */
function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid flex-none place-items-center rounded-full bg-(image:--avatar-fill) font-semibold text-cyan-950',
        size === 'md' ? 'size-8.5 text-caption' : 'size-10 text-body',
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

/**
 * Thanh điều hướng 60px trên **dải trời** V2.3 (`ChuyenHang.jpg`, `v3.css` `.topbar`): logo trái, nhóm mục trên kính tối
 * (`.glass-nav`), tìm nhanh · ngôn ngữ · chuông · tài khoản phải. Mục đang mở có nền cyan trong + viền + quầng, chữ trắng 600 — nền
 * riêng của mục là phản hồi duy nhất (V2.3 bỏ chỉ báo kính trượt theo con trỏ của V2). Dưới 1.340px mục chỉ còn icon, tên nằm ở
 * `aria-label`.
 */
export function NavRail() {
  const t = useT()
  const { user, signOut } = useAuth()
  const can = useCan()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    void navigate('/dang-nhap', { replace: true })
  }

  return (
    <header className="sky flex h-15 flex-none items-center gap-5 px-4 xl:gap-6 xl:px-shell">
      <Link
        to="/"
        aria-label={t('nav.home')}
        className="flex flex-none items-center gap-2.5 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <BrandMark />
        <span aria-hidden className="hidden font-display text-[18px] leading-none font-bold tracking-[-0.2px] text-sky-text font-stretch-112% lg:inline">
          Load<span className="text-cyan-300">Master</span>
        </span>
      </Link>

      <nav aria-label={t('nav.label')} className="glass-nav flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-lg p-1 min-[1400px]:flex-none">
        {NAV_ITEMS.filter((item) => can(item.permission)).map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={t(labelKey)}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2 rounded-md px-2.5 text-body whitespace-nowrap xl:px-3.5',
                'transition-colors duration-(--dur-fast) ease-standard',
                'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300',
                isActive
                  ? 'bg-(image:--nav-on) font-semibold text-sky-text shadow-nav-on'
                  : 'font-medium text-sky-text-2 hover:bg-sky-glass hover:text-sky-text',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('size-4.5 flex-none', isActive ? 'text-cyan-200' : 'opacity-80')} strokeWidth={isActive ? 2 : 1.5} aria-hidden />
                <span className="hidden min-[1340px]:inline">{t(labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex flex-none items-center gap-2.5">
        <QuickSearch />
        <LanguageMenu />
        <NotificationBell />

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('nav.account', { name: user.fullName })}
              className="rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 data-[state=open]:shadow-[0_0_0_2px_var(--cyan-300)]"
            >
              <Avatar name={user.fullName} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="w-72">
              <DropdownMenuLabel className="flex-row items-center gap-3 px-2.5 py-2.5">
                <Avatar name={user.fullName} size="lg" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body font-semibold text-ink-strong">{user.fullName}</span>
                  <span className="truncate text-small text-ink-3">{user.email}</span>
                </span>
              </DropdownMenuLabel>
              <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2 text-small text-ink-3">
                <Badge>{t(`roles.${user.role}`)}</Badge>
                {user.depot}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/ho-so">
                  <UserRound strokeWidth={1.5} aria-hidden />
                  {t('nav.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleSignOut()}>
                <LogOut strokeWidth={1.5} aria-hidden />
                {t('nav.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  )
}
