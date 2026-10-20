import { expect, test } from 'vitest'
import { PUBLIC_HOME, PUBLIC_PRICING, PUBLIC_PRIVACY } from '@/features/auth/landing'
import { seo } from '@/lib/i18n/vi/seo'
import { SITE_INFO } from '@/lib/site-info'
import { faqEntries, robotsTxt, seoBlock, sitemapXml, structuredData, withFontPreloads, withSeoBlock } from './html-head'
import { SEO_PAGES, seoPageOf } from './pages'

/** HTML tĩnh của trang công khai (plugin `seo` của `vite.config.ts`): thẻ meta, Open Graph, JSON-LD, robots, sitemap, tải trước font. */

const INDEX = '<head>\n    <meta name="viewport" content="width=device-width" />\n    <title>LoadMaster</title>\n  </head>'

function jsonLd(block: string): { '@graph': Record<string, unknown>[] } {
  const json = /<script type="application\/ld\+json">(.*)<\/script>/.exec(block)?.[1]
  if (json === undefined) throw new Error('không có JSON-LD')
  return JSON.parse(json) as { '@graph': Record<string, unknown>[] }
}

test('the public pages are the same paths the router serves', () => {
  expect(SEO_PAGES).toStrictEqual({ landing: PUBLIC_HOME, pricing: PUBLIC_PRICING, privacy: PUBLIC_PRIVACY })
  expect(seoPageOf('/gioi-thieu')).toBe('landing')
  expect(seoPageOf('/bang-gia/')).toBe('pricing')
  expect(seoPageOf('/chinh-sach-bao-mat')).toBe('privacy')
  expect(seoPageOf('/')).toBeNull()
  expect(seoPageOf('/dang-nhap')).toBeNull()
})

test('each page has its own title, description, canonical address and share preview, all absolute on the site address', () => {
  const block = seoBlock('pricing', seo)
  expect(block).toContain(`<title>${seo.pages.pricing.title}</title>`)
  expect(block).toContain(`<meta name="description" content="${seo.pages.pricing.description}" />`)
  expect(block).toContain('<link rel="canonical" href="https://loadmaster.vn/bang-gia" />')
  expect(block).toContain('<meta property="og:url" content="https://loadmaster.vn/bang-gia" />')
  expect(block).toContain('<meta property="og:image" content="https://loadmaster.vn/og-image.png" />')
  expect(block).toContain('<meta property="og:image:width" content="1200" />')
  expect(block).toContain('<meta property="og:image:height" content="630" />')
  expect(block).toContain(`<meta property="og:image:alt" content="${seo.imageAlt}" />`)
})

test('text is escaped inside attributes and inside the JSON-LD script', () => {
  const text = { ...seo, pages: { ...seo.pages, landing: { title: 'A & "B"', description: '<script>' } } }
  const block = seoBlock('landing', text, [{ q: 'Q</script>', a: 'A' }])
  expect(block).toContain('<title>A &amp; &quot;B&quot;</title>')
  expect(block).toContain('content="&lt;script&gt;"')
  expect(block).not.toContain('Q</script>')
  expect(jsonLd(block)['@graph'].at(-1)).toMatchObject({ mainEntity: [{ name: 'Q</script>' }] })
})

test('the organisation is described only with facts the site has: no phone, address or tax code while they are unknown', () => {
  const [organization, website] = jsonLd(seoBlock('privacy', seo))['@graph']
  expect(organization).toStrictEqual({
    '@type': 'Organization',
    '@id': 'https://loadmaster.vn/#organization',
    name: 'LoadMaster',
    url: 'https://loadmaster.vn',
    email: 'hotro@loadmaster.vn',
    logo: 'https://loadmaster.vn/icon-512.png',
  })
  expect(SITE_INFO.phone).toBeNull()
  expect(website).toMatchObject({ '@type': 'WebSite', url: 'https://loadmaster.vn', publisher: { '@id': 'https://loadmaster.vn/#organization' } })
})

test('the FAQ is structured data of the introduction page only, and only when it has questions', () => {
  const faq = [{ q: 'Có cần cài đặt không?', a: 'Không, chạy trên trình duyệt.' }]
  expect(structuredData('landing', faq)).toMatchObject({
    '@graph': [{}, {}, { '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: faq[0]!.q, acceptedAnswer: { '@type': 'Answer', text: faq[0]!.a } }] }],
  })
  expect(jsonLd(seoBlock('landing', seo))['@graph']).toHaveLength(2)
  expect(jsonLd(seoBlock('pricing', seo, faq))['@graph']).toHaveLength(2)
})

test('FAQ entries are read defensively from the dictionary branch', () => {
  expect(faqEntries(undefined)).toStrictEqual([])
  expect(faqEntries({ title: 'Câu hỏi thường gặp' })).toStrictEqual([])
  expect(
    faqEntries({
      items: {
        install: { q: ' Có cần cài đặt không? ', a: 'Không.' },
        count: { q: 'Bao nhiêu kiện?', a: 'Tới {count} kiện.' },
        broken: { q: 'Thiếu câu trả lời' },
        notText: 3,
      },
    }),
  ).toStrictEqual([{ q: 'Có cần cài đặt không?', a: 'Không.' }])
})

test('the head block replaces the title once, then replaces itself for each page', () => {
  const landing = withSeoBlock(INDEX, seoBlock('landing', seo))
  expect(landing).not.toContain('<title>LoadMaster</title>')
  const pricing = withSeoBlock(landing, seoBlock('pricing', seo))
  expect(pricing.match(/<title>/g)).toHaveLength(1)
  expect(pricing).toContain('https://loadmaster.vn/bang-gia')
  expect(pricing).not.toContain('https://loadmaster.vn/gioi-thieu"')
})

test('robots.txt and the sitemap point to the site address', () => {
  expect(robotsTxt()).toBe('User-agent: *\nAllow: /\n\nSitemap: https://loadmaster.vn/sitemap.xml\n')
  const sitemap = sitemapXml()
  expect(sitemap).toContain('<loc>https://loadmaster.vn/gioi-thieu</loc>')
  expect(sitemap).toContain('<loc>https://loadmaster.vn/bang-gia</loc>')
  expect(sitemap).toContain('<loc>https://loadmaster.vn/chinh-sach-bao-mat</loc>')
  expect(sitemap.match(/<url>/g)).toHaveLength(3)
})

test('only the Vietnamese and Latin subsets of the heading font are preloaded, right after the viewport tag', () => {
  const html = withFontPreloads(INDEX, [
    'assets/index-Ab12.js',
    'assets/archivo-latin-ext-wdth-normal-Cd34.woff2',
    'assets/archivo-latin-wdth-normal-Ef56.woff2',
    'assets/archivo-vietnamese-wdth-normal-Gh78.woff2',
  ])
  expect(html).toContain('<link rel="preload" href="/assets/archivo-latin-wdth-normal-Ef56.woff2" as="font" type="font/woff2" crossorigin />')
  expect(html).toContain('<link rel="preload" href="/assets/archivo-vietnamese-wdth-normal-Gh78.woff2" as="font" type="font/woff2" crossorigin />')
  expect(html).not.toContain('latin-ext')
  expect(html.indexOf('viewport')).toBeLessThan(html.indexOf('rel="preload"'))
  expect(withFontPreloads(INDEX, ['assets/index-Ab12.js'])).toBe(INDEX)
})
