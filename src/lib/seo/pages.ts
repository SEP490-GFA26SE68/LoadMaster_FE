/**
 * Ba trang công khai có thẻ meta riêng (tiêu đề, mô tả, canonical): khoá của nhánh `seo.pages` → đường dẫn. Đường dẫn trùng
 * `PUBLIC_HOME`, `PUBLIC_PRICING`, `PUBLIC_PRIVACY` của `features/auth/landing.ts` — `pages.test.ts` canh việc đó. File thuần, không
 * import qua `@/`: `vite.config.ts` đọc thẳng nó lúc build.
 */
export const SEO_PAGES = {
  landing: '/gioi-thieu',
  pricing: '/bang-gia',
  privacy: '/chinh-sach-bao-mat',
} as const

export type SeoPage = keyof typeof SEO_PAGES

/** Trang công khai của một đường dẫn (bỏ qua `/` cuối do máy chủ tĩnh thêm), `null` khi không phải trang nào trong ba trang. */
export function seoPageOf(pathname: string): SeoPage | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  for (const [page, pagePath] of Object.entries(SEO_PAGES) as [SeoPage, string][]) {
    if (pagePath === path) return page
  }
  return null
}
