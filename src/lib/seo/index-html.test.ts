import { expect, test } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import { SHARE_IMAGE_PATH } from './site-files'

/** `index.html` mang thẻ tĩnh cho bộ cào không chạy JavaScript: chúng phải nói cùng một điều với từ điển và với ảnh trong `public/`. */
const files = import.meta.glob<string>(['/index.html', '/public/og-image.png'], { query: '?raw', import: 'default', eager: true })
const html = files['/index.html'] ?? ''

function contentOf(selector: RegExp): string | null {
  const tag = html.match(selector)?.[0] ?? null
  return tag?.match(/content="([^"]*)"/)?.[1] ?? null
}

test('the static description is the landing description of the Vietnamese dictionary', () => {
  expect(contentOf(/<meta\s+name="description"[^>]*>/)).toBe(vi.seo.pages.landing)
  expect(contentOf(/<meta\s+property="og:description"[^>]*>/)).toBe(vi.seo.pages.landing)
})

test('the static tags describe a website in Vietnamese with a large share image that exists', () => {
  expect(contentOf(/<meta\s+property="og:type"[^>]*>/)).toBe('website')
  expect(contentOf(/<meta\s+property="og:locale"[^>]*>/)).toBe('vi_VN')
  expect(contentOf(/<meta\s+name="twitter:card"[^>]*>/)).toBe('summary_large_image')
  expect(contentOf(/<meta\s+property="og:image"[^>]*>/)).toBe(SHARE_IMAGE_PATH)
  expect(Object.keys(files)).toContain(`/public${SHARE_IMAGE_PATH}`)
  expect(contentOf(/<meta\s+property="og:title"[^>]*>/)).toBe(html.match(/<title>([^<]*)<\/title>/)?.[1])
})

test('the static HTML names no domain, canonical address or robots rule — those depend on the page and the deployment', () => {
  expect(html).toContain('<title>')
  expect(html).not.toMatch(/rel="canonical"|property="og:url"|name="robots"/)
})
