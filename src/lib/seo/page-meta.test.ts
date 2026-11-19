import { expect, test } from 'vitest'
import { pageMeta } from './page-meta'
import { faqPageLd, jsonLdText, softwareApplicationLd } from './structured-data'

const base = { title: 'Bảng giá · LoadMaster', description: 'Mô tả', locale: 'vi' } as const

test('an indexable page is indexed and, with a site URL, carries its canonical address', () => {
  expect(pageMeta({ ...base, page: 'pricing', siteUrl: 'https://example.test' })).toStrictEqual({
    title: 'Bảng giá · LoadMaster',
    description: 'Mô tả',
    robots: 'index, follow',
    canonical: 'https://example.test/bang-gia',
    ogLocale: 'vi_VN',
    structuredData: null,
  })
})

test('without a site URL there is no canonical address, but the page is still indexed', () => {
  const meta = pageMeta({ ...base, page: 'terms', siteUrl: null })
  expect(meta.robots).toBe('index, follow')
  expect(meta.canonical).toBeNull()
})

test('every other screen is noindex, with no canonical address and no structured data', () => {
  const meta = pageMeta({ ...base, page: null, siteUrl: 'https://example.test', structuredData: { '@type': 'Thing' } })
  expect(meta.robots).toBe('noindex')
  expect(meta.canonical).toBeNull()
  expect(meta.structuredData).toBeNull()
})

test('og:locale follows the interface language', () => {
  expect(pageMeta({ ...base, page: 'landing', siteUrl: null, locale: 'en' }).ogLocale).toBe('en_US')
})

test('the application block states only what exists: no rating, review, offer, email or phone', () => {
  const input = { name: 'LoadMaster', description: 'Mô tả', pagePath: '/gioi-thieu', languages: ['vi', 'en'] }
  const local = softwareApplicationLd({ ...input, siteUrl: null })
  expect(local).toStrictEqual({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'LoadMaster',
    description: 'Mô tả',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: ['vi', 'en'],
  })
  expect(softwareApplicationLd({ ...input, siteUrl: 'https://example.test' })).toMatchObject({
    url: 'https://example.test/gioi-thieu',
    image: 'https://example.test/og-image.png',
  })
  expect(JSON.stringify(softwareApplicationLd({ ...input, siteUrl: 'https://example.test' }))).not.toMatch(
    /aggregateRating|review|offers|email|telephone/,
  )
})

test('the FAQ block has one accepted answer per question, and its text cannot close the script tag', () => {
  const data = faqPageLd([{ question: 'Hỏi?', answer: 'Đáp </script><b>' }])
  expect(data).toStrictEqual({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: 'Hỏi?', acceptedAnswer: { '@type': 'Answer', text: 'Đáp </script><b>' } }],
  })
  const text = jsonLdText(data)
  expect(text).not.toContain('<')
  expect(JSON.parse(text)).toStrictEqual(data)
})
