import { useId, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { ROLE_ICON } from '@/components/RoleBadge'
import { useAuth } from '@/features/auth/AuthProvider'
import { landingPath } from '@/features/auth/landing'
import { useT, type MessageKey } from '@/lib/i18n'
import { SITE_INFO } from '@/lib/site-info'
import { isCurrentLink, type PublicLink } from '../public-chrome'
import { LineRise } from '../reveal'
import { FOOTER_ROLES, mailtoHref, PRIVACY_LINK, PRODUCT_LINKS, SUPPORT_LINKS } from './footer-links'
import { FOOTER_HEADING, FOOTER_LINK } from './footer-styles'

/** Tiêu đề cột thứ `index` lên khỏi mặt nạ sau khối thương hiệu, so le 70 ms một cột (trên trang giới thiệu, chuyển động bật). */
function headingDelay(index: number): number {
  return 200 + index * 70
}

/** Một liên kết trong trang công khai; mục là chính trang đang mở thì mang `aria-current="page"` (neo trong trang thì không). */
function FooterLink({ link }: { link: PublicLink }) {
  const t = useT()
  const { pathname } = useLocation()
  return (
    <Link to={link.to} aria-current={isCurrentLink(link, pathname) ? 'page' : undefined} className={FOOTER_LINK}>
      {t(link.labelKey)}
    </Link>
  )
}

/**
 * Một cột liên kết: `<nav>` mang tên của tiêu đề cột. Tiêu đề là `<h2>` — chân trang đứng ngang hàng với các phần của trang, không nằm
 * dưới phần cuối cùng của nội dung chính.
 */
function LinkColumn({ titleKey, index, children }: { titleKey: MessageKey; index: number; children: ReactNode }) {
  const t = useT()
  const titleId = useId()
  return (
    <nav aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
      <LineRise as="h2" id={titleId} delay={headingDelay(index)} className={FOOTER_HEADING} lines={[t(titleKey)]} />
      <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
    </nav>
  )
}

/** Năm vai trò trong công ty dùng LoadMaster: danh sách để đọc, không phải liên kết — tên vai trò lấy từ nhánh `roles` của từ điển. */
function RolesColumn() {
  const t = useT()
  const titleId = useId()
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <LineRise as="h2" id={titleId} delay={headingDelay(1)} className={FOOTER_HEADING} lines={[t('landingFooter.columns.roles')]} />
      <ul aria-labelledby={titleId} className="m-0 flex list-none flex-col gap-1 p-0">
        {FOOTER_ROLES.map((role) => {
          const Icon = ROLE_ICON[role]
          return (
            <li key={role} className="flex min-h-11 items-center gap-3 text-body text-sky-text-2 pointer-coarse:text-body-lg">
              <span aria-hidden className="grid size-7 flex-none place-items-center rounded-sm border border-landing-hairline bg-sky-glass text-cyan-300">
                <Icon className="size-4" strokeWidth={1.5} />
              </span>
              {t(`roles.${role}`)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Bốn cột của chân trang, theo thứ tự đọc: Sản phẩm (các phần của trang giới thiệu và Bảng giá), Dành cho (vai trò), Hỗ trợ (hỏi đáp,
 * liên hệ, email), Tài khoản và pháp lý ("Đăng nhập" — đã đăng nhập thì "Vào ứng dụng" như đầu trang — và chính sách bảo mật). Trả về
 * bốn phần tử liền nhau để lưới của chân trang xếp chúng cạnh khối thương hiệu.
 */
export function FooterColumns() {
  const t = useT()
  const { user } = useAuth()
  return (
    <>
      <LinkColumn titleKey="landingFooter.columns.product" index={0}>
        {PRODUCT_LINKS.map((link) => <li key={link.labelKey}><FooterLink link={link} /></li>)}
      </LinkColumn>
      <RolesColumn />
      <LinkColumn titleKey="landingFooter.columns.support" index={2}>
        {SUPPORT_LINKS.map((link) => <li key={link.labelKey}><FooterLink link={link} /></li>)}
        <li>
          <a href={mailtoHref(SITE_INFO.supportEmail)} className={FOOTER_LINK}>{t('landingFooter.links.email')}</a>
        </li>
      </LinkColumn>
      <LinkColumn titleKey="landingFooter.columns.legal" index={3}>
        <li>
          <Link to={user ? landingPath(user.role) : '/dang-nhap'} className={FOOTER_LINK}>
            {user ? t('landingFooter.links.openApp') : t('landingFooter.links.signIn')}
          </Link>
        </li>
        <li><FooterLink link={PRIVACY_LINK} /></li>
      </LinkColumn>
    </>
  )
}
