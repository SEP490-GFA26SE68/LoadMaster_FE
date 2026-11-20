import type { Locale } from '@/lib/i18n'
import { absoluteUrl, SEO_PAGES, type SeoPage } from './site-files'

/** Ngôn ngữ của thẻ `og:locale` theo ngôn ngữ giao diện. */
export const OG_LOCALES: Readonly<Record<Locale, string>> = { vi: 'vi_VN', en: 'en_US' }

/** Thẻ của màn đang mở — `applyPageMeta` ghi chúng vào `<head>`. */
export type PageMeta = {
  /** Tiêu đề tab, cũng là `og:title`. */
  readonly title: string
  readonly description: string
  /** Chỉ trang công khai trong `SEO_PAGES` được lập chỉ mục. */
  readonly robots: 'index, follow' | 'noindex'
  /** Địa chỉ chuẩn của trang (cũng là `og:url`); `null` khi màn không lập chỉ mục hoặc chưa khai `VITE_SITE_URL`. */
  readonly canonical: string | null
  readonly ogLocale: string
  /** Khối JSON-LD của trang (`null`: không có). */
  readonly structuredData: object | null
}

/**
 * Thẻ của một màn (thuần). `page` là trang công khai được lập chỉ mục, `null` cho mọi màn khác: màn đó mang `noindex`, không canonical,
 * không JSON-LD, và mô tả chung của sản phẩm. Địa chỉ chuẩn không kèm truy vấn (`?lang=`, `?goi=`) hay neo.
 */
export function pageMeta({ page, title, description, locale, siteUrl, structuredData = null }: {
  page: SeoPage | null
  title: string
  description: string
  locale: Locale
  siteUrl: string | null
  structuredData?: object | null
}): PageMeta {
  return {
    title,
    description,
    robots: page === null ? 'noindex' : 'index, follow',
    canonical: page === null || siteUrl === null ? null : absoluteUrl(siteUrl, SEO_PAGES[page]),
    ogLocale: OG_LOCALES[locale],
    structuredData: page === null ? null : structuredData,
  }
}
