import { LifeBuoy, LogOut, UserRound } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { LogoMark } from '@/components/brand/LogoMark'
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
import { can } from '@/features/auth/permissions'
import { EtaRiskWatcher } from '@/features/monitoring/EtaRiskWatcher'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { QuickSearch } from '@/features/search/QuickSearch'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { initialsOf } from '@/types/user'
import { logoPath, navItemsFor } from './nav-items'
import { useGlassFollow } from './useGlassFollow'

/** Hộp thoại yêu cầu hỗ trợ (FE-8-07) tải khi mở lần đầu: chỉ người dùng công ty mở. */
const SupportTicketDialog = lazy(() => import('@/features/support/SupportTicketDialog').then((m) => ({ default: m.SupportTicketDialog })))

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
 * (`.glass-nav`), tìm nhanh · ngôn ngữ · chuông · tài khoản phải. Nền cyan kính là **chỉ báo trượt theo con trỏ**
 * (`useGlassFollow`, `.glass-follow`): bám mục đang rê / focus, về mục đang mở khi con trỏ rời thanh. Mục đang mở chỉ có chữ trắng
 * 600 và icon `--cyan-200`, không nền riêng — hai lớp nền sẽ chồng nhau. Dưới 1.340px mục chỉ còn icon, tên nằm ở `aria-label`.
 * Mục và thứ tự theo vai trò khai ở `nav-items.ts` (FE-0-04).
 */
export function NavRail() {
  const t = useT()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { navRef, followRef } = useGlassFollow<HTMLElement>()
  const [supportOpen, setSupportOpen] = useState(false)
  // Mục và thứ tự theo vai trò (`NAV_ITEMS`), chỉ mục vai trò có quyền mở
  const items = user ? navItemsFor(user.role) : []

  async function handleSignOut() {
    await signOut()
    void navigate('/dang-nhap', { replace: true })
  }

  return (
    <header className="sky flex h-15 flex-none items-center gap-5 px-4 xl:gap-6 xl:px-shell">
      <Link
        to={logoPath(user?.role)}
        aria-label={t('nav.home')}
        className="flex flex-none items-center gap-2.5 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <LogoMark tone="dark" />
        <span aria-hidden className="hidden font-display text-[18px] leading-none font-bold tracking-[-0.2px] text-(--logo-on-dark) font-stretch-106% lg:inline">
          Load<span className="text-(--logo-sky)">Master</span>
        </span>
      </Link>

      {/* Vai trò không có mục nào thì không vẽ khay kính rỗng (hiện cả tám vai trò đều có) */}
      {items.length > 0 ? (
        <nav
          ref={navRef}
          aria-label={t('nav.label')}
          className="glass-nav relative flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-lg p-1 min-[1400px]:flex-none"
        >
          <span ref={followRef} aria-hidden className="glass-follow" />
          {items.map(({ to, labelKey, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              aria-label={t(labelKey)}
              className={({ isActive }) =>
                cn(
                  'relative z-1 flex h-9 items-center gap-2 rounded-md px-2.5 text-body whitespace-nowrap xl:px-3.5',
                  'transition-colors duration-(--dur-fast) ease-standard',
                  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300',
                  isActive ? 'font-semibold text-sky-text' : 'font-medium text-sky-text-2 hover:text-sky-text',
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
      ) : null}

      <div className="ml-auto flex flex-none items-center gap-2.5">
        <QuickSearch />
        <LanguageMenu />
        <NotificationBell />
        <EtaRiskWatcher />

        {user ? (
          <DropdownMenu modal={false}>
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
              {/* Người dùng nền tảng không thuộc kho nào (FE-0-03): chỉ còn nhãn vai trò */}
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
              {can(user.role, 'support.create') ? (
                <DropdownMenuItem onSelect={() => setSupportOpen(true)}>
                  <LifeBuoy strokeWidth={1.5} aria-hidden />
                  {t('nav.supportRequests')}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => void handleSignOut()}>
                <LogOut strokeWidth={1.5} aria-hidden />
                {t('nav.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {supportOpen ? (
        <Suspense fallback={null}>
          <SupportTicketDialog onClose={() => setSupportOpen(false)} />
        </Suspense>
      ) : null}
    </header>
  )
}
