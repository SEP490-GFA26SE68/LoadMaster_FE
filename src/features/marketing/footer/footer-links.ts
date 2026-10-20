import { PUBLIC_HOME, PUBLIC_PRICING, PUBLIC_PRIVACY } from '@/features/auth/landing'
import type { MessageKey } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { AXLE_ANCHOR, COMPARE_ANCHOR, FAQ_ANCHOR, FEATURES_ANCHOR, HOW_ANCHOR, TRY_ANCHOR } from '../anchors'
import { CONTACT_ANCHOR } from '../contact-form'
import type { PublicLink } from '../public-chrome'

/**
 * Liên kết của chân trang. Neo đi kèm `pathname` của trang giới thiệu nên bấm từ Bảng giá hay Chính sách bảo mật vẫn tới đúng phần
 * (`useHashScroll` cuộn và đưa focus vào tiêu đề của phần đó).
 */
function section(labelKey: MessageKey, anchor: string): PublicLink {
  return { labelKey, to: { pathname: PUBLIC_HOME, hash: `#${anchor}` } }
}

export const PRODUCT_LINKS: readonly PublicLink[] = [
  section('landingFooter.links.features', FEATURES_ANCHOR),
  section('landingFooter.links.axle', AXLE_ANCHOR),
  section('landingFooter.links.how', HOW_ANCHOR),
  section('landingFooter.links.try', TRY_ANCHOR),
  section('landingFooter.links.compare', COMPARE_ANCHOR),
  { labelKey: 'landingFooter.links.pricing', to: { pathname: PUBLIC_PRICING } },
]

export const CONTACT_LINK: PublicLink = section('landingFooter.links.contact', CONTACT_ANCHOR)

export const SUPPORT_LINKS: readonly PublicLink[] = [section('landingFooter.links.faq', FAQ_ANCHOR), CONTACT_LINK]

export const PRIVACY_LINK: PublicLink = { labelKey: 'landingFooter.links.privacy', to: { pathname: PUBLIC_PRIVACY } }

/** Năm vai trò vận hành của một công ty logistics, theo thứ tự của một chuyến: lập chuyến → xếp → giao → theo dõi → quản trị tài khoản. */
export const FOOTER_ROLES: readonly Role[] = ['dispatcher', 'warehouse', 'driver', 'manager', 'companyAdmin']

export function mailtoHref(email: string): string {
  return `mailto:${email}`
}

/** Số điện thoại thành liên kết `tel:` — bỏ khoảng trắng, dấu chấm, gạch nối, ngoặc; giữ dấu `+` đầu. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
