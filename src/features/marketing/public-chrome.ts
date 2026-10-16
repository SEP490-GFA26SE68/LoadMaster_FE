import { PUBLIC_HOME, PUBLIC_PRICING } from '@/features/auth/landing'
import type { MessageKey } from '@/lib/i18n'
import { CONTACT_ANCHOR } from './contact-form'

/**
 * Phần dùng chung của hai trang công khai (`/gioi-thieu`, `/bang-gia`): cỡ chạm và mục điều hướng của đầu trang. Đầu trang hiện mục
 * thành hàng từ 1.024 px (bốn mục vừa cả tiếng Việt lẫn tiếng Anh), hẹp hơn thì gom vào nút menu (`PublicNavMenu`).
 */

/** Ô nhập, nút và mục menu cao 56px, chữ 16px khi con trỏ là ngón tay (AGENTS mục 10). */
export const PUBLIC_TOUCH = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'

export type PublicLink = { readonly labelKey: MessageKey; readonly to: { readonly pathname: string; readonly hash?: string } }

/** Mục của trang giới thiệu: neo trong trang, riêng Bảng giá là trang khác. */
export const PUBLIC_LINKS: readonly PublicLink[] = [
  { labelKey: 'landing.header.features', to: { pathname: PUBLIC_HOME, hash: '#tinh-nang' } },
  { labelKey: 'landing.header.how', to: { pathname: PUBLIC_HOME, hash: '#cach-hoat-dong' } },
  { labelKey: 'landing.header.pricing', to: { pathname: PUBLIC_PRICING } },
  { labelKey: 'landing.header.contact', to: { pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` } },
]

/** Mục là trang đang mở (`aria-current="page"`): chỉ mục là trang riêng — neo trong trang không phải "trang hiện tại". */
export function isCurrentLink(link: PublicLink, pathname: string): boolean {
  return link.to.hash === undefined && pathname === link.to.pathname
}
