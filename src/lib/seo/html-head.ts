import { SITE_INFO } from '../site-info.ts'
import { SEO_PAGES, type SeoPage } from './pages.ts'

/**
 * Phần `<head>` của HTML tĩnh cho công cụ tìm kiếm và ô xem trước khi chia sẻ liên kết — hàm thuần, plugin `seo` của `vite.config.ts`
 * gọi lúc build (và lúc chạy dev) để ghi `index.html` cùng một bản HTML riêng cho mỗi trang công khai. Bot của mạng xã hội không chạy
 * JavaScript nên mọi thứ ở đây phải nằm sẵn trong HTML. Mọi đường dẫn tuyệt đối dựng từ `SITE_INFO.url`, không viết lại tên miền.
 * Import có đuôi `.ts` vì file này còn được kiểm kiểu trong project Node của `vite.config.ts`.
 */

/** Chữ của nhánh `seo` (bản tiếng Việt khi build). */
export type SeoText = {
  readonly imageAlt: string
  readonly pages: Readonly<Record<SeoPage, { readonly title: string; readonly description: string }>>
}

/** Một câu hỏi của mục Hỏi đáp (`landingFaq.items`), đã kiểm là chữ thuần. */
export type FaqEntry = { readonly q: string; readonly a: string }

/** Ảnh xem trước khi chia sẻ (`public/og-image.png`). */
export const OG_IMAGE = { path: '/og-image.png', width: 1200, height: 630, type: 'image/png' } as const

/** Cặp dấu bao khối thẻ do plugin ghi, để bản HTML của từng trang thay đúng khối đó. */
const BLOCK_START = '<!--seo-->'
const BLOCK_END = '<!--/seo-->'
const BLOCK = /<!--seo-->[\s\S]*?<!--\/seo-->/
const TITLE = /<title>[\s\S]*?<\/title>/
const PLACEHOLDER = /\{\w+\}/

export function absoluteUrl(path: string): string {
  return SITE_INFO.url + path
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** JSON trong `<script>`: `<` viết thành `<` để không chuỗi nào đóng được thẻ script. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

function textField(record: object, key: string): string | null {
  const value: unknown = Reflect.get(record, key)
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text === '' || PLACEHOLDER.test(text) ? null : text
}

/**
 * Câu hỏi của `landingFaq.items` (`{ [mã]: { q, a } }`) đọc phòng thủ: nhánh còn thiếu hay sai dạng thì không có câu nào; câu còn chỗ
 * chèn số (`{count}`) chưa điền thì bỏ — dữ liệu có cấu trúc phải khớp chữ hiện trên trang.
 */
export function faqEntries(branch: unknown): FaqEntry[] {
  if (typeof branch !== 'object' || branch === null) return []
  const items: unknown = Reflect.get(branch, 'items')
  if (typeof items !== 'object' || items === null) return []
  const entries: FaqEntry[] = []
  for (const item of Object.values(items)) {
    if (typeof item !== 'object' || item === null) continue
    const q = textField(item, 'q')
    const a = textField(item, 'a')
    if (q !== null && a !== null) entries.push({ q, a })
  }
  return entries
}

/** Dữ liệu có cấu trúc (schema.org): tổ chức và website ở mọi trang, Hỏi đáp ở trang giới thiệu khi có câu hỏi. */
export function structuredData(page: SeoPage, faq: readonly FaqEntry[]): object {
  const organizationId = absoluteUrl('/#organization')
  const graph: object[] = [
    {
      '@type': 'Organization',
      '@id': organizationId,
      name: SITE_INFO.name,
      url: SITE_INFO.url,
      email: SITE_INFO.supportEmail,
      logo: absoluteUrl('/icon-512.png'),
      // Chưa có số điện thoại, địa chỉ, mã số thuế thật thì không ghi trường nào (`site-info.ts`)
      ...(SITE_INFO.phone ? { telephone: SITE_INFO.phone } : {}),
      ...(SITE_INFO.address ? { address: SITE_INFO.address } : {}),
      ...(SITE_INFO.taxCode ? { taxID: SITE_INFO.taxCode } : {}),
    },
    { '@type': 'WebSite', '@id': absoluteUrl('/#website'), name: SITE_INFO.name, url: SITE_INFO.url, inLanguage: 'vi', publisher: { '@id': organizationId } },
  ]
  if (page === 'landing' && faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': absoluteUrl(`${SEO_PAGES.landing}#hoi-dap`),
      inLanguage: 'vi',
      mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

/** Khối thẻ của một trang: tiêu đề, mô tả, canonical, Open Graph và dữ liệu có cấu trúc, bọc trong cặp dấu của plugin. */
export function seoBlock(page: SeoPage, text: SeoText, faq: readonly FaqEntry[] = []): string {
  const { title, description } = text.pages[page]
  const url = absoluteUrl(SEO_PAGES[page])
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_INFO.name)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${absoluteUrl(OG_IMAGE.path)}" />`,
    `<meta property="og:image:type" content="${OG_IMAGE.type}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(text.imageAlt)}" />`,
    `<script type="application/ld+json">${scriptJson(structuredData(page, faq))}</script>`,
  ]
  return [BLOCK_START, ...tags, BLOCK_END].join('\n    ')
}

/** Đặt khối thẻ vào HTML: thay khối đã có, chưa có thì thay thẻ `<title>`. */
export function withSeoBlock(html: string, block: string): string {
  if (BLOCK.test(html)) return html.replace(BLOCK, () => block)
  if (!TITLE.test(html)) throw new Error('index.html thiếu thẻ <title> để đặt khối thẻ SEO')
  return html.replace(TITLE, () => block)
}

/** `robots.txt`: mọi bot được đọc, kèm địa chỉ sitemap. Màn trong ứng dụng tự đặt `noindex` lúc chạy (`route-title.ts`). */
export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`
}

/** `sitemap.xml` của ba trang công khai. */
export function sitemapXml(): string {
  const urls = Object.values(SEO_PAGES).map((path) => `  <url><loc>${absoluteUrl(path)}</loc></url>`)
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n')
}

/** Font Archivo của phần đầu trang (dải tiếng Việt và latin), tên file đã băm của Vite: `assets/archivo-latin-wdth-normal-Ab12.woff2`. */
const ABOVE_FOLD_FONT = /(^|\/)archivo-(vietnamese|latin)-wdth-normal-[\w-]+\.woff2$/
const VIEWPORT = /<meta name="viewport"[^>]*>/

/**
 * Thẻ tải trước font tiêu đề, đặt ngay sau thẻ viewport: chữ Archivo có sẵn trước lần vẽ đầu thay vì đổi font giữa chừng (CLS). Dải
 * latin mở rộng không tải trước — tiêu đề tiếng Việt và tiếng Anh không dùng tới.
 */
export function withFontPreloads(html: string, fileNames: readonly string[], base = '/'): string {
  const links = fileNames
    .filter((name) => ABOVE_FOLD_FONT.test(name))
    .toSorted()
    .map((name) => `<link rel="preload" href="${base}${name}" as="font" type="font/woff2" crossorigin />`)
  if (links.length === 0) return html
  if (!VIEWPORT.test(html)) throw new Error('index.html thiếu thẻ viewport để đặt thẻ tải trước font')
  return html.replace(VIEWPORT, (viewport) => [viewport, ...links].join('\n    '))
}
