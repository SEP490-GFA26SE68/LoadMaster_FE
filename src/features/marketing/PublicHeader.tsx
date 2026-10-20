import { Link, useLocation } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { LogoMark } from '@/components/brand/LogoMark'
import { useGlassFollow } from '@/components/useGlassFollow'
import { PUBLIC_HOME } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { isCurrentLink, PUBLIC_LINKS, PUBLIC_TOUCH } from './public-chrome'
import { PublicHeaderActions } from './PublicHeaderActions'
import { useHeaderScroll } from './useHeaderScroll'
import './public-header.css'
import './sections.css'

/** Neo của các mục là phần của trang giới thiệu — đầu trang tô mục của phần đang đọc. */
const SPY_IDS: readonly string[] = PUBLIC_LINKS.flatMap((link) => (link.to.hash ? [link.to.hash.slice(1)] : []))
const NO_SPY: readonly string[] = []
/** Chỉ báo kính về mục là trang đang mở (Bảng giá) hoặc mục của phần đang đọc. */
const GLASS_ACTIVE = '[aria-current="page"], [data-active]'

/**
 * Đầu trang của hai trang công khai (`/gioi-thieu`, `/bang-gia`): dải trời dính trên cùng khi cuộn — logo về trang giới thiệu (vùng bấm
 * 48 px, 56 px trên máy cảm ứng), mục của trang, rồi `PublicHeaderActions` (Liên hệ gọn, ngôn ngữ, Đăng nhập, nút menu). Mục của trang
 * thành hàng từ 1.024 px — nơi bốn mục vừa cả hai ngôn ngữ —, hẹp hơn thì gom vào nút menu. Không có nút đăng ký hay mua gói; vòng focus
 * `--cyan-300` như mọi điều khiển trên dải trời.
 *
 * Mục của trang nằm trong khay kính `.glass-nav` như thanh điều hướng của ứng dụng, với chỉ báo kính cyan trượt `.glass-follow`
 * (`useGlassFollow`): bám mục đang rê / focus, về mục là trang đang mở hoặc — ở trang giới thiệu — mục của phần đang đọc khi con trỏ rời
 * khay; giữa hai phần không có mục nào thì chỉ báo ẩn. Mục của phần đang đọc chỉ để nhìn, không `aria-current` (neo trong trang không phải
 * "trang hiện tại"). Cuộn qua phần mở đầu thì nền đặc hơn và có đường kẻ đáy (`useHeaderScroll` → `data-scrolled`, `public-header.css`).
 * `progress` (chỉ trang giới thiệu): vạch tiến độ cuộn 2 px `--cyan-300` ở mép dưới, `aria-hidden`, chạy bằng CSS scroll timeline
 * (`sections.css`) — không có thì không vẽ, giảm chuyển động thì tắt.
 */
export function PublicHeader({ progress = false }: { progress?: boolean }) {
  const t = useT()
  const { pathname } = useLocation()
  const { ref, active } = useHeaderScroll(pathname === PUBLIC_HOME ? SPY_IDS : NO_SPY)
  const { navRef, followRef } = useGlassFollow<HTMLElement>(GLASS_ACTIVE)

  return (
    <header ref={ref} className="public-header sky sticky top-0 z-20 flex-none">
      {progress ? <span aria-hidden className="landing-progress pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-cyan-300" /> : null}
      <div className="relative flex h-16 items-center gap-2 px-3 min-[400px]:px-4 md:gap-6 md:px-shell pointer-coarse:h-20">
        <Link
          to={PUBLIC_HOME}
          aria-label={t('landingChrome.home')}
          className={cn(
            'flex min-h-12 min-w-12 flex-none items-center justify-center gap-2.5 rounded-md outline-none',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 pointer-coarse:min-h-14 pointer-coarse:min-w-14',
          )}
        >
          <LogoMark tone="dark" className="sm:hidden" />
          <Logo tone="dark" size="sm" decorative className="hidden sm:inline-flex" />
        </Link>

        <nav
          ref={navRef}
          aria-label={t('landingChrome.nav')}
          className="glass-nav relative hidden min-w-0 flex-none items-center gap-0.5 rounded-lg p-1 lg:flex"
        >
          <span ref={followRef} aria-hidden className="glass-follow" />
          {PUBLIC_LINKS.map((link) => {
            const current = isCurrentLink(link, pathname)
            const reading = active !== null && link.to.hash === `#${active}`
            return (
              <Link
                key={link.labelKey}
                to={link.to}
                aria-current={current ? 'page' : undefined}
                data-active={reading ? '' : undefined}
                className={cn(
                  'relative z-1 flex h-9 items-center rounded-md px-3.5 text-body whitespace-nowrap transition-colors duration-(--dur-fast) ease-standard',
                  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300',
                  // Phần đang đọc chỉ đổi màu chữ, không đậm hơn: đậm lên là mục rộng ra và các mục sau xô theo mỗi lần cuộn sang phần khác
                  current ? 'font-semibold text-sky-text' : 'font-medium hover:text-sky-text',
                  !current && (reading ? 'text-sky-text' : 'text-sky-text-2'),
                  PUBLIC_TOUCH,
                )}
              >
                {t(link.labelKey)}
              </Link>
            )
          })}
        </nav>

        <PublicHeaderActions />
      </div>
    </header>
  )
}
