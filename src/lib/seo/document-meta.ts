import type { PageMeta } from './page-meta'
import { jsonLdText } from './structured-data'

/**
 * Ghi thẻ của màn đang mở vào `<head>` lúc chạy (`app/route-title.ts`). `index.html` mang sẵn thẻ tĩnh của sản phẩm cho bộ cào không
 * chạy JavaScript; ở đây chỉ sửa giá trị theo trang và ngôn ngữ, thêm hoặc gỡ canonical, `og:url`, `robots` và khối JSON-LD của trang.
 */

/** Khối JSON-LD do hàm này quản: đúng một thẻ, gỡ khi sang màn không có dữ liệu có cấu trúc. */
const JSON_LD_SELECTOR = 'script[data-seo="page"]'

function upsert(selector: string, create: () => HTMLElement): HTMLElement {
  const existing = document.head.querySelector<HTMLElement>(selector)
  if (existing) return existing
  const element = create()
  document.head.append(element)
  return element
}

function setMeta(attribute: 'name' | 'property', key: string, content: string | null): void {
  const selector = `meta[${attribute}="${key}"]`
  if (content === null) {
    document.head.querySelector(selector)?.remove()
    return
  }
  upsert(selector, () => {
    const meta = document.createElement('meta')
    meta.setAttribute(attribute, key)
    return meta
  }).setAttribute('content', content)
}

function setCanonical(href: string | null): void {
  if (href === null) {
    document.head.querySelector('link[rel="canonical"]')?.remove()
    return
  }
  upsert('link[rel="canonical"]', () => {
    const link = document.createElement('link')
    link.rel = 'canonical'
    return link
  }).setAttribute('href', href)
}

function setStructuredData(data: object | null): void {
  if (data === null) {
    document.head.querySelector(JSON_LD_SELECTOR)?.remove()
    return
  }
  upsert(JSON_LD_SELECTOR, () => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.dataset.seo = 'page'
    return script
  }).textContent = jsonLdText(data)
}

export function applyPageMeta(meta: PageMeta): void {
  setMeta('name', 'description', meta.description)
  setMeta('name', 'robots', meta.robots)
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
  setMeta('property', 'og:locale', meta.ogLocale)
  setMeta('property', 'og:url', meta.canonical)
  setCanonical(meta.canonical)
  setStructuredData(meta.structuredData)
}
