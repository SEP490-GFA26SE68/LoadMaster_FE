import type { TFunction } from '@/lib/i18n'
import { BILLING_CONSTANTS } from '@/lib/mock-db/billing-model'
import type { FaqEntry } from '@/lib/seo/structured-data'
import type { Role } from '@/types/user'
import { topicOf, type AnswerPart, type AssistantContext, type TopicId } from '../assistant/assistant-kb'
import { FAQ_TOPICS } from './faq-topics'

/**
 * Câu hỏi và câu trả lời của phần Hỏi đáp dưới dạng chữ thường, cho khối JSON-LD `FAQPage` (thuần). Chữ phải trùng điều trang đang hiện:
 * cùng từ điển, cùng thứ tự phần và cùng ngữ cảnh với `TopicAnswer` — `FaqStructuredData.dom.test.tsx` so từng câu với phần Hỏi đáp đã vẽ.
 */

/** Vai trò và thiết bị của phần `roleDevices`, như `AssistantFacts` vẽ. */
const ROLE_DEVICES: readonly [Role, 'desktop' | 'desktopTablet' | 'tablet' | 'phone'][] = [
  ['dispatcher', 'desktop'],
  ['warehouse', 'tablet'],
  ['driver', 'phone'],
  ['companyManager', 'desktopTablet'],
  ['companyAdmin', 'desktop'],
]

/** Chữ của một phần trả lời; `null` cho phần chưa có dạng chữ thường (danh mục gói, các bước…) — câu hỏi đó bị bỏ khỏi JSON-LD. */
function partText(topicId: TopicId, part: AnswerPart, t: TFunction, context: AssistantContext): string | null {
  switch (part) {
    case 'answer':
      return topicId === 'start' && context.selfSignUp ? t('assistant.topics.start.answerSelf') : t(`assistant.topics.${topicId}.answer`)
    case 'creditCost':
      return t('landing.plans.credit', { count: BILLING_CONSTANTS.optimizationCost })
    case 'roleDevices':
      return ROLE_DEVICES.map(([role, device]) =>
        t('assistant.facts.roleLine', { role: t(`roles.${role}`), device: t(`assistant.facts.devices.${device}`) }),
      ).join('; ')
    default:
      return null
  }
}

export function faqEntries(t: TFunction, context: AssistantContext, topics: readonly TopicId[] = FAQ_TOPICS): FaqEntry[] {
  return topics.flatMap((id) => {
    const parts = topicOf(id).parts(context).map((part) => partText(id, part, t, context))
    if (parts.some((text) => text === null)) return []
    return [{ question: t(`assistant.topics.${id}.chip`), answer: parts.join(' ') }]
  })
}
