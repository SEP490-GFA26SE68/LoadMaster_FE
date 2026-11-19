/**
 * Phần thuần của SEO dùng chung cho app và cho plugin `seo` của `vite.config.ts` (chạy trong Node lúc build): trang nào được lập chỉ
 * mục, địa chỉ tuyệt đối, `robots.txt`, `sitemap.xml`. File **không import gì** — cấu hình Vite không đọc được `@/` hay kiểu của DOM.
 * Tên miền không viết trong code: chỉ có khi bản cài đặt đặt `VITE_SITE_URL`.
 */

/**
 * Trang công khai được lập chỉ mục: khoá của nhánh `seo.pages` → đường dẫn. Mọi màn khác (đăng nhập, đăng ký, trong ứng dụng, 404) mang
 * `noindex`. Năm đường dẫn trùng hằng `PUBLIC_*` của `features/auth/landing.ts` (`site-files.test.ts` canh).
 */
export const SEO_PAGES = {
  landing: '/gioi-thieu',
  pricing: '/bang-gia',
  privacy: '/chinh-sach-bao-mat',
  terms: '/dieu-khoan-su-dung',
  samplePlan: '/phuong-an-mau',
} as const

export type SeoPage = keyof typeof SEO_PAGES

const PAGE_ENTRIES = Object.entries(SEO_PAGES) as [SeoPage, string][]

/** Trang được lập chỉ mục của một đường dẫn (bỏ `/` cuối do máy chủ tĩnh thêm); `null` khi không phải trang nào. */
export function seoPageOf(pathname: string): SeoPage | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return PAGE_ENTRIES.find(([, pagePath]) => pagePath === path)?.[0] ?? null
}

/**
 * Địa chỉ gốc của trang công khai từ `VITE_SITE_URL`: bỏ `/` cuối; để trống là `null` (không canonical, không `og:url`, không sitemap).
 * Giá trị không phải địa chỉ `http(s)` tuyệt đối, hoặc kèm truy vấn / neo, là lỗi ngay lúc build và lúc mở app.
 */
export function resolveSiteUrl(value: string | undefined): string | null {
  const text = value?.trim() ?? ''
  if (text === '') return null
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new Error(`VITE_SITE_URL phải là địa chỉ tuyệt đối (https://…), đang là "${text}"`)
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.search !== '' || url.hash !== '') {
    throw new Error(`VITE_SITE_URL phải là địa chỉ http(s) không kèm truy vấn hay neo, đang là "${text}"`)
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

/** Địa chỉ tuyệt đối của một đường dẫn bắt đầu bằng `/`. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl}${path}`
}

/** Cho mọi bộ cào đọc mọi trang (màn không lập chỉ mục tự mang `noindex` — chặn cào thì bộ cào không đọc được thẻ đó). */
export function robotsTxt(siteUrl: string | null): string {
  const lines = ['User-agent: *', 'Allow: /']
  if (siteUrl !== null) lines.push('', `Sitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}`)
  return `${lines.join('\n')}\n`
}

const XML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escapeXml = (text: string) => [...text].map((char) => XML_ESCAPES[char] ?? char).join('')

/** Sơ đồ trang: đúng các trang được lập chỉ mục, địa chỉ tuyệt đối. */
export function sitemapXml(siteUrl: string, paths: readonly string[] = Object.values(SEO_PAGES)): string {
  const urls = paths.map((path) => `  <url><loc>${escapeXml(absoluteUrl(siteUrl, path))}</loc></url>`)
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n')
}

/** Ảnh chia sẻ của `index.html` (đường dẫn từ gốc trang). */
export const SHARE_IMAGE_PATH = '/og-image.png'

/**
 * HTML tĩnh của bản build: có `VITE_SITE_URL` thì ảnh chia sẻ thành địa chỉ tuyệt đối — bộ cào của Zalo, Facebook không chạy JavaScript
 * và không tự ghép đường dẫn tương đối. Không có thì giữ nguyên.
 */
export function withAbsoluteShareImage(html: string, siteUrl: string | null): string {
  if (siteUrl === null) return html
  return html.replaceAll(`content="${SHARE_IMAGE_PATH}"`, `content="${absoluteUrl(siteUrl, SHARE_IMAGE_PATH)}"`)
}
