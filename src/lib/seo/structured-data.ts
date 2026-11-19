import { absoluteUrl, SHARE_IMAGE_PATH } from './site-files'

/**
 * Dữ liệu có cấu trúc (schema.org, JSON-LD) của trang giới thiệu — thuần. Chỉ ghi điều có thật: không điểm đánh giá, không lời nhận xét,
 * không giá (giá gói còn là giá tạm), không email hay điện thoại (chưa công bố).
 */

/** Ứng dụng doanh nghiệp chạy trên web. Địa chỉ và ảnh chỉ có khi bản cài đặt khai `VITE_SITE_URL`. */
export function softwareApplicationLd({ name, description, pagePath, siteUrl, languages }: {
  name: string
  description: string
  pagePath: string
  siteUrl: string | null
  languages: readonly string[]
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: languages,
    ...(siteUrl === null ? {} : { url: absoluteUrl(siteUrl, pagePath), image: absoluteUrl(siteUrl, SHARE_IMAGE_PATH) }),
  }
}

export type FaqEntry = { readonly question: string; readonly answer: string }

/** Trang hỏi đáp: mỗi câu hỏi một câu trả lời bằng chữ thường, đúng chữ đang hiện trên trang. */
export function faqPageLd(entries: readonly FaqEntry[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}

/** Chữ đặt trong `<script type="application/ld+json">`: `<` viết thành `<` để dữ liệu không đóng được thẻ script. */
export function jsonLdText(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
