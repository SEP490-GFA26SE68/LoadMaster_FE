import { PUBLIC_HOME, PUBLIC_PRICING } from '@/features/auth/landing'
import type { MessageKey } from '@/lib/i18n'
import { FEATURES_ANCHOR, HOW_ANCHOR } from './anchors'
import { CONTACT_ANCHOR } from './contact-form'

/**
 * Phần dùng chung của hai trang công khai (`/gioi-thieu`, `/bang-gia`): cỡ chạm và mục điều hướng của đầu trang. Đầu trang hiện mục
 * thành hàng từ 1.024 px (bốn mục vừa cả tiếng Việt lẫn tiếng Anh), hẹp hơn thì gom vào nút menu (`PublicNavMenu`).
 */

/** Ô nhập, nút và mục menu cao 56px, chữ 16px khi con trỏ là ngón tay (AGENTS mục 10). */
export const PUBLIC_TOUCH = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'

/**
 * Nhãn và chip nhỏ (20–26 px) lên chữ 16 px trên máy cảm ứng (AGENTS mục 10), xuống dòng được khi khung hẹp — hai dòng dài gần bằng nhau.
 * `shrink`: chip trong hàng flex được co tới chữ dài nhất để xuống dòng, không giữ cả câu trên một dòng rồi tràn khỏi thẻ.
 */
export const PUBLIC_TOUCH_TAG =
  'pointer-coarse:h-auto pointer-coarse:min-h-7 pointer-coarse:shrink pointer-coarse:whitespace-normal pointer-coarse:text-balance pointer-coarse:py-1 pointer-coarse:text-body-lg pointer-coarse:leading-5'

export type PublicLink = { readonly labelKey: MessageKey; readonly to: { readonly pathname: string; readonly hash?: string } }

/** Đích của "Liên hệ": form liên hệ cuối trang giới thiệu (mục của hàng điều hướng và nút "Liên hệ" gọn dưới 1.024 px). */
export const CONTACT_LINK: PublicLink = { labelKey: 'landingChrome.contact', to: { pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` } }

/** Mục của trang giới thiệu: neo trong trang, riêng Bảng giá là trang khác. */
export const PUBLIC_LINKS: readonly PublicLink[] = [
  { labelKey: 'landingChrome.features', to: { pathname: PUBLIC_HOME, hash: `#${FEATURES_ANCHOR}` } },
  { labelKey: 'landingChrome.how', to: { pathname: PUBLIC_HOME, hash: `#${HOW_ANCHOR}` } },
  { labelKey: 'landingChrome.pricing', to: { pathname: PUBLIC_PRICING } },
  CONTACT_LINK,
]

/** Mục là trang đang mở (`aria-current="page"`): chỉ mục là trang riêng — neo trong trang không phải "trang hiện tại". */
export function isCurrentLink(link: PublicLink, pathname: string): boolean {
  return link.to.hash === undefined && pathname === link.to.pathname
}
