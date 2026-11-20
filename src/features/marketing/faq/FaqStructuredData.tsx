import { useT } from '@/lib/i18n'
import { faqPageLd, jsonLdText } from '@/lib/seo/structured-data'
import { useAssistantContext } from '../assistant/useAssistantChat'
import { faqEntries } from './faq-entries'

/**
 * Khối JSON-LD `FAQPage` của phần Hỏi đáp, cho công cụ tìm kiếm: đúng các câu hỏi và câu trả lời đang hiện, theo ngôn ngữ đang chọn. Nằm
 * ngay trong phần Hỏi đáp nên chỉ có ở trang có phần đó; không vẽ gì cho người xem.
 */
export function FaqStructuredData() {
  const t = useT()
  const context = useAssistantContext()
  const entries = faqEntries(t, context)
  if (entries.length === 0) return null
  return <script type="application/ld+json" data-seo="faq" dangerouslySetInnerHTML={{ __html: jsonLdText(faqPageLd(entries)) }} />
}
