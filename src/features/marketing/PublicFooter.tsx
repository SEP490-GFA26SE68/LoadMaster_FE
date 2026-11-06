import { useId } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { PUBLIC_HOME, PUBLIC_PRICING } from '@/features/auth/landing'
import { useT, type MessageKey } from '@/lib/i18n'
import { CONTACT_ANCHOR } from './contact-form'

type FooterLink = { labelKey: MessageKey; to: { pathname: string; hash?: string } }

/** Hai cột liên kết: các trang của sản phẩm, rồi lối vào ứng dụng. */
const COLUMNS: readonly { titleKey: MessageKey; links: readonly FooterLink[] }[] = [
  {
    titleKey: 'landing.footer.product',
    links: [
      { labelKey: 'landing.footer.landing', to: { pathname: PUBLIC_HOME } },
      { labelKey: 'landing.footer.pricing', to: { pathname: PUBLIC_PRICING } },
      { labelKey: 'landing.footer.contact', to: { pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` } },
    ],
  },
  { titleKey: 'landing.footer.account', links: [{ labelKey: 'landing.footer.signIn', to: { pathname: '/dang-nhap' } }] },
]

function FooterColumn({ titleKey, links }: { titleKey: MessageKey; links: readonly FooterLink[] }) {
  const t = useT()
  const titleId = useId()
  return (
    <div className="flex min-w-36 flex-col gap-1">
      {/* Tiêu đề cột là chữ thường, không phải tiêu đề mục: Bảng giá chỉ có tên gói ở cấp 2 */}
      <p id={titleId} className="m-0 px-2 text-small font-semibold text-sky-text pointer-coarse:text-body-lg">{t(titleKey)}</p>
      <ul aria-labelledby={titleId} className="m-0 flex list-none flex-col p-0">
        {links.map(({ labelKey, to }) => (
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
    </div>
  )
}

/**
 * Chân trang của hai trang công khai: nền tối đặc `--panel-dark`, logo kèm khẩu hiệu (`BRAND_TAGLINE` — tên riêng, không dịch), hai cột
 * liên kết và một câu nói thật về bản demo (dữ liệu mẫu, kết quả tối ưu mang MOCK RESULT). Không địa chỉ, số điện thoại hay mạng xã hội:
 * chưa có nguồn nào cho chúng.
 */
export function PublicFooter() {
  const t = useT()
  return (
    <footer className="flex-none bg-panel-dark text-sky-text-2">
      <div className="flex flex-col gap-8 px-4 pt-12 pb-8 md:px-shell">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <Logo tone="dark" size="md" tagline />
          <nav aria-label={t('landing.footer.nav')} className="flex flex-wrap gap-x-10 gap-y-6 md:-mr-2">
            {COLUMNS.map((column) => <FooterColumn key={column.titleKey} {...column} />)}
          </nav>
        </div>
        <div className="border-t border-landing-hairline pt-6">
          <p className="m-0 max-w-240 text-small text-pretty text-sky-text-3 pointer-coarse:text-body-lg">{t('landing.footer.note')}</p>
        </div>
      </div>
    </footer>
  )
}
