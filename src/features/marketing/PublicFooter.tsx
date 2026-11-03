import { Link } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { PUBLIC_HOME, PUBLIC_PRICING } from '@/features/auth/landing'
import { useT, type MessageKey } from '@/lib/i18n'
import { CONTACT_ANCHOR } from './contact-form'

const LINKS: readonly { labelKey: MessageKey; to: { pathname: string; hash?: string } }[] = [
  { labelKey: 'landing.footer.landing', to: { pathname: PUBLIC_HOME } },
  { labelKey: 'landing.footer.pricing', to: { pathname: PUBLIC_PRICING } },
  { labelKey: 'landing.footer.contact', to: { pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` } },
  { labelKey: 'landing.footer.signIn', to: { pathname: '/dang-nhap' } },
]

/**
 * Chân trang của hai trang công khai: nền tối đặc `--panel-dark`, logo kèm khẩu hiệu (`BRAND_TAGLINE` — tên riêng, không dịch) và liên
 * kết của các trang. Không địa chỉ, số điện thoại hay mạng xã hội: chưa có nguồn nào cho chúng.
 */
export function PublicFooter() {
  const t = useT()
  return (
    <footer className="flex-none bg-panel-dark text-sky-text-2">
      <div className="flex flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-shell">
        <Logo tone="dark" size="md" tagline />
        <nav aria-label={t('landing.footer.nav')}>
          <ul className="m-0 flex list-none flex-wrap gap-x-2 gap-y-1 p-0">
            {LINKS.map(({ labelKey, to }) => (
              <li key={labelKey}>
                <Link
                  to={to}
                  className="flex h-10 items-center rounded-md px-2 text-body font-medium transition-colors duration-(--dur-fast) ease-standard outline-none hover:text-sky-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 pointer-coarse:h-14 pointer-coarse:text-body-lg"
                >
                  {t(labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
