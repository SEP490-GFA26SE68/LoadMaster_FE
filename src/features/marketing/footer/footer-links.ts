import { GUEST_REGISTRATION, PUBLIC_HOME, PUBLIC_PRICING, PUBLIC_PRIVACY, PUBLIC_SAMPLE_PLAN, PUBLIC_TERMS, TRIAL_REGISTRATION } from '@/features/auth/landing'
import type { MessageKey } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { CONTACT_ANCHOR } from '../contact-form'
import { FAQ_ANCHOR } from '../faq/faq-topics'
import type { PublicLink } from '../public-chrome'
import { TRY_ANCHOR } from '../try/try-anchor'

/**
 * Liên kết của chân trang — chỉ trỏ tới thứ đang có: các phần của trang giới thiệu, Bảng giá, phương án mẫu 3D, Hỏi đáp, form liên hệ, chính sách bảo mật, điều khoản sử dụng
 * và hai trang đăng ký. Neo đi kèm `pathname` của trang giới thiệu nên bấm từ trang khác vẫn tới đúng phần (`useHashScroll` cuộn và đưa
 * focus vào tiêu đề của phần đó).
 */
function section(labelKey: MessageKey, anchor: string): PublicLink {
  return { labelKey, to: { pathname: PUBLIC_HOME, hash: `#${anchor}` } }
}

/** `id` của hai phần trên trang giới thiệu (`LandingJourney`, `LandingPlans`). */
const HOW_ANCHOR = 'cach-hoat-dong'
const PLANS_ANCHOR = 'goi-cuoc'

export const PRODUCT_LINKS: readonly PublicLink[] = [
  section('landingFooter.links.how', HOW_ANCHOR),
  section('landingFooter.links.try', TRY_ANCHOR),
  section('landingFooter.links.plans', PLANS_ANCHOR),
  { labelKey: 'landingFooter.links.pricing', to: { pathname: PUBLIC_PRICING } },
  { labelKey: 'landingFooter.links.samplePlan', to: { pathname: PUBLIC_SAMPLE_PLAN } },
]

export const CONTACT_LINK: PublicLink = section('landingFooter.links.contact', CONTACT_ANCHOR)

export const SUPPORT_LINKS: readonly PublicLink[] = [
  section('landingFooter.links.faq', FAQ_ANCHOR),
  CONTACT_LINK,
  { labelKey: 'landingFooter.links.privacy', to: { pathname: PUBLIC_PRIVACY } },
  { labelKey: 'landingFooter.links.terms', to: { pathname: PUBLIC_TERMS } },
]

/** Hai lối đăng ký của khách chưa đăng nhập; chỉ vẽ khi khách tự đăng ký được (`REGISTRATION_CAPABILITIES.publicSignUp`). */
export const SIGN_UP_LINKS: readonly PublicLink[] = [
  { labelKey: 'landingFooter.links.trial', to: { pathname: TRIAL_REGISTRATION } },
  { labelKey: 'landingFooter.links.registerNow', to: { pathname: GUEST_REGISTRATION } },
]

/** Năm vai trò vận hành của một công ty logistics, theo thứ tự của một chuyến: lập chuyến → xếp → giao → theo dõi → quản trị tài khoản. */
export const FOOTER_ROLES: readonly Role[] = ['dispatcher', 'warehouse', 'driver', 'companyManager', 'companyAdmin']

export function mailtoHref(email: string): string {
  return `mailto:${email}`
}

/** Số điện thoại thành liên kết `tel:` — bỏ khoảng trắng, dấu chấm, gạch nối, ngoặc; giữ dấu `+` đầu. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
