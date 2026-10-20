import type { landingFaq } from '@/lib/i18n/vi/landingFaq'

/** Mã một câu hỏi của mục Hỏi đáp: khoá của `landingFaq.items` (tiếng Việt là nguồn chuẩn, tiếng Anh giữ đúng bộ khoá). */
export type FaqId = keyof (typeof landingFaq)['items']

/**
 * Thứ tự câu hỏi trên trang: đúng thứ tự khai trong từ điển, để thẻ FAQPage (JSON-LD, đọc thẳng nhánh `landingFaq.items`) và trang nói
 * cùng một danh sách. Thiếu hay thừa mã so với từ điển là test đỏ (`LandingFaq.dom.test.tsx`).
 */
export const FAQ_IDS = [
  'whatIs',
  'start',
  'devices',
  'roles',
  'import',
  'credit',
  'axle',
  'data',
  'language',
] as const satisfies readonly FaqId[]
