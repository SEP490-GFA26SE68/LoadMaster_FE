import { Link, useLocation } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { LogoMark } from '@/components/brand/LogoMark'
import { LanguageMenu } from '@/components/LanguageMenu'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { landingPath, PUBLIC_HOME } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { isCurrentLink, PUBLIC_LINKS, PUBLIC_TOUCH } from './public-chrome'
import { PublicNavMenu } from './PublicNavMenu'
import './sections.css'

/**
 * Đầu trang của hai trang công khai (`/gioi-thieu`, `/bang-gia`): dải trời dính trên cùng khi cuộn — logo về trang giới thiệu (vùng bấm
 * 48 px, 56 px trên máy cảm ứng), mục của trang, ngôn ngữ, và "Đăng nhập" (đã đăng nhập thì "Vào ứng dụng", mở màn chính của vai trò).
 * Mục của trang thành hàng từ 1.024 px — nơi bốn mục vừa cả hai ngôn ngữ —, hẹp hơn thì gom vào nút menu. Ngôn ngữ là hai nút VI | EN
 * từ 640 px, hẹp hơn là một nút mở menu (điện thoại 360 px không đủ chỗ cho hai nút 56 px cạnh "Đăng nhập" và nút menu). Không có nút
 * đăng ký hay mua gói; vòng focus `--cyan-300` như mọi điều khiển trên dải trời. `progress` (chỉ trang giới thiệu): vạch tiến độ cuộn
 * 2 px `--cyan-300` ở mép dưới, `aria-hidden`, chạy bằng CSS scroll timeline (`sections.css`) — không có thì không vẽ, giảm chuyển động
 * thì tắt; không đánh dấu phần đang đọc.
 */
export function PublicHeader({ progress = false }: { progress?: boolean }) {
  const t = useT()
  const { user } = useAuth()
  const { pathname } = useLocation()

  return (
    <header className="sky sticky top-0 z-20 flex-none">
      {progress ? <span aria-hidden className="landing-progress pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-cyan-300" /> : null}
      <div className="flex h-16 items-center gap-3 px-4 md:gap-6 md:px-shell pointer-coarse:h-20">
        <Link
          to={PUBLIC_HOME}
          aria-label={t('landing.header.home')}
          className={cn(
            'flex min-h-12 min-w-12 flex-none items-center justify-center gap-2.5 rounded-md outline-none',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 pointer-coarse:min-h-14 pointer-coarse:min-w-14',
          )}
        >
          <LogoMark tone="dark" className="sm:hidden" />
          <Logo tone="dark" size="sm" decorative className="hidden sm:inline-flex" />
        </Link>

        <nav aria-label={t('landing.header.nav')} className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
          {PUBLIC_LINKS.map((link) => {
            const current = isCurrentLink(link, pathname)
            return (
              <Link
                key={link.labelKey}
                to={link.to}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex h-10 items-center rounded-md px-3 text-body whitespace-nowrap transition-colors duration-(--dur-fast) ease-standard',
                  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300',
                  current ? 'font-semibold text-sky-text' : 'font-medium text-sky-text-2 hover:bg-sky-glass hover:text-sky-text',
                  PUBLIC_TOUCH,
                )}
              >
                {t(link.labelKey)}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex flex-none items-center gap-2 md:gap-3">
          <LanguageSwitch
            tone="sky"
            className="hidden sm:flex pointer-coarse:[&_button]:size-14 pointer-coarse:[&_button]:text-body-lg"
          />
          <LanguageMenu
            className="h-10 min-w-10 sm:hidden pointer-coarse:h-14 pointer-coarse:min-w-14 pointer-coarse:text-body-lg"
            itemClassName={PUBLIC_TOUCH}
          />
          <Button asChild variant="glass" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
            <Link to={user ? landingPath(user.role) : '/dang-nhap'}>
              {user ? t('landing.header.openApp') : t('landing.header.signIn')}
            </Link>
          </Button>
          <PublicNavMenu className="lg:hidden" />
        </div>
      </div>
    </header>
  )
}
