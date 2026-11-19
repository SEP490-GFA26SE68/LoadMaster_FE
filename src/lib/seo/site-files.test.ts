import { expect, test } from 'vitest'
import { PUBLIC_HOME, PUBLIC_PRICING, PUBLIC_PRIVACY, PUBLIC_SAMPLE_PLAN, PUBLIC_TERMS } from '@/features/auth/landing'
import { resolveSiteUrl, robotsTxt, SEO_PAGES, seoPageOf, sitemapXml, withAbsoluteShareImage } from './site-files'

test('the indexable pages are the public pages of the app, by the same paths as the router', () => {
  expect(SEO_PAGES).toStrictEqual({
    landing: PUBLIC_HOME,
    pricing: PUBLIC_PRICING,
    privacy: PUBLIC_PRIVACY,
    terms: PUBLIC_TERMS,
    samplePlan: PUBLIC_SAMPLE_PLAN,
  })
})

test('a path maps to its indexable page, with or without a trailing slash; anything else is not indexable', () => {
  expect(seoPageOf('/gioi-thieu')).toBe('landing')
  expect(seoPageOf('/bang-gia/')).toBe('pricing')
  expect(seoPageOf('/chinh-sach-bao-mat')).toBe('privacy')
  expect(seoPageOf('/dieu-khoan-su-dung')).toBe('terms')
  expect(seoPageOf('/phuong-an-mau')).toBe('samplePlan')
  expect(seoPageOf('/')).toBeNull()
  expect(seoPageOf('/dang-nhap')).toBeNull()
  expect(seoPageOf('/dang-ky')).toBeNull()
  expect(seoPageOf('/gioi-thieu/khac')).toBeNull()
  expect(seoPageOf('/chuyen/TRIP-2026-0914')).toBeNull()
})

test('the site URL is optional: empty means none, a trailing slash is dropped', () => {
  expect(resolveSiteUrl(undefined)).toBeNull()
  expect(resolveSiteUrl('')).toBeNull()
  expect(resolveSiteUrl('   ')).toBeNull()
  expect(resolveSiteUrl('https://example.test')).toBe('https://example.test')
  expect(resolveSiteUrl(' https://example.test/ ')).toBe('https://example.test')
  expect(resolveSiteUrl('https://example.test/app/')).toBe('https://example.test/app')
  expect(resolveSiteUrl('http://localhost:5173')).toBe('http://localhost:5173')
})

test('a site URL that is not an absolute http(s) address, or carries a query or a hash, is an error', () => {
  expect(() => resolveSiteUrl('example.test')).toThrow(/VITE_SITE_URL/)
  expect(() => resolveSiteUrl('/gioi-thieu')).toThrow(/VITE_SITE_URL/)
  expect(() => resolveSiteUrl('ftp://example.test')).toThrow(/VITE_SITE_URL/)
  expect(() => resolveSiteUrl('https://example.test/?lang=en')).toThrow(/VITE_SITE_URL/)
  expect(() => resolveSiteUrl('https://example.test/#lien-he')).toThrow(/VITE_SITE_URL/)
})

test('robots.txt lets every crawler in; the Sitemap line only exists with a site URL', () => {
  expect(robotsTxt(null)).toBe('User-agent: *\nAllow: /\n')
  expect(robotsTxt('https://example.test')).toBe('User-agent: *\nAllow: /\n\nSitemap: https://example.test/sitemap.xml\n')
})

test('the sitemap lists exactly the indexable pages as absolute addresses', () => {
  const xml = sitemapXml('https://example.test')
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true)
  expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).toStrictEqual([
    'https://example.test/gioi-thieu',
    'https://example.test/bang-gia',
    'https://example.test/chinh-sach-bao-mat',
    'https://example.test/dieu-khoan-su-dung',
    'https://example.test/phuong-an-mau',
  ])
  expect(sitemapXml('https://example.test', ['/a?b=1&c=2'])).toContain('<loc>https://example.test/a?b=1&amp;c=2</loc>')
})

test('the share image of the static HTML becomes absolute only with a site URL', () => {
  const html = '<meta property="og:image" content="/og-image.png" /><link rel="icon" href="/favicon.svg" />'
  expect(withAbsoluteShareImage(html, null)).toBe(html)
  expect(withAbsoluteShareImage(html, 'https://example.test')).toBe(
    '<meta property="og:image" content="https://example.test/og-image.png" /><link rel="icon" href="/favicon.svg" />',
  )
})
