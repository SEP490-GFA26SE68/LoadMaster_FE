import { beforeAll, describe, expect, test } from 'vitest'
import { GUEST_REGISTRATION, PUBLIC_HOME, PUBLIC_PRICING, TRIAL_REGISTRATION } from '@/features/auth/landing'
import { createTranslator, loadLocale } from '@/lib/i18n'
import { contactPath } from '../contact-form'
import {
  FALLBACK_TOPICS,
  SECTION_ANCHORS,
  STARTER_TOPICS,
  TOPIC_IDS,
  TOPICS,
  topicOf,
  type AssistantContext,
} from './assistant-kb'
import { matchText } from './assistant-match'

/** Mã nguồn của các phần trang giới thiệu (kể cả "Một chuyến hàng" ở `journey/`), để kiểm mọi neo mà câu trả lời trỏ tới có thật. */
const LANDING_SOURCES = import.meta.glob<string>(['../Landing*.tsx', '../journey/Landing*.tsx'], { query: '?raw', import: 'default', eager: true })

const CONTEXTS: readonly AssistantContext[] = [
  { selfSignUp: false, mockRoutes: true },
  { selfSignUp: true, mockRoutes: true },
  { selfSignUp: false, mockRoutes: false },
  { selfSignUp: true, mockRoutes: false },
]

beforeAll(() => loadLocale('en'))

/** Số câu của một đoạn: dấu kết câu theo sau là khoảng trắng hay hết đoạn ("1.000" không phải hai câu). */
const sentences = (text: string) => text.match(/[.!?…](\s|$)/g)?.length ?? 0

describe('assistant knowledge base', () => {
  test('one topic per id, in TOPIC_IDS order', () => {
    expect(TOPICS.map((topic) => topic.id)).toStrictEqual([...TOPIC_IDS])
    expect(topicOf('plans').id).toBe('plans')
  })

  test.each(['vi', 'en'] as const)('every topic has a suggested question and an answer of at most three sentences (%s)', (locale) => {
    const t = createTranslator(locale)
    for (const id of TOPIC_IDS) {
      const chip = t(`assistant.topics.${id}.chip`)
      const answer = t(`assistant.topics.${id}.answer`)
      expect(chip.trim(), id).not.toBe('')
      expect(answer.trim(), id).not.toBe('')
      expect([id, sentences(answer) <= 3]).toStrictEqual([id, true])
    }
    expect(sentences(t('assistant.topics.start.answerSelf'))).toBeLessThanOrEqual(3)
  })

  test('the opening message says Lumo answers from LoadMaster documents, not as a sales person', () => {
    expect(createTranslator('vi')('assistant.panel.intro', { name: 'Lumo' })).toBe(
      'Lumo trả lời từ tài liệu của LoadMaster — không phải nhân viên tư vấn.',
    )
  })

  test('no answer claims to be an AI or promises a reply time', () => {
    for (const locale of ['vi', 'en'] as const) {
      const t = createTranslator(locale)
      for (const id of TOPIC_IDS) {
        const answer = t(`assistant.topics.${id}.answer`)
        expect([id, /AI optimized|trí tuệ nhân tạo tối ưu|trong \d+ giờ|within \d+ hours/i.test(answer)]).toStrictEqual([id, false])
      }
    }
  })

  test('keywords are already in matching form (no accents, lower case) and not repeated', () => {
    for (const topic of TOPICS) {
      const words = [...topic.keywords, ...(topic.hints ?? [])]
      for (const word of words) expect([topic.id, word, matchText(word)]).toStrictEqual([topic.id, word, word])
      expect(new Set(words).size, topic.id).toBe(words.length)
    }
  })

  test('suggested and follow-up questions name real topics', () => {
    const ids = new Set<string>(TOPIC_IDS)
    for (const id of [...STARTER_TOPICS, ...FALLBACK_TOPICS, ...TOPICS.flatMap((topic) => topic.followUps)]) expect(ids.has(id)).toBe(true)
    for (const topic of TOPICS) expect(topic.followUps, topic.id).not.toContain(topic.id)
  })

  test('every section a link points to exists on the landing page', () => {
    const source = Object.values(LANDING_SOURCES).join('\n')
    for (const anchor of Object.values(SECTION_ANCHORS)) expect(source).toContain(`id="${anchor}"`)
  })

  test('links go only to public routes; sign-up routes only when visitors can sign up themselves', () => {
    const allowed = [PUBLIC_PRICING, contactPath({ type: 'DEMO_REQUEST' }), TRIAL_REGISTRATION, GUEST_REGISTRATION]
    for (const context of CONTEXTS) {
      const targets = TOPICS.flatMap((topic) => topic.actions(context).map((action) => action.to))
      for (const to of targets) expect(to.startsWith(`${PUBLIC_HOME}#`) || allowed.includes(to), to).toBe(true)
      const signUp = targets.filter((to) => to === TRIAL_REGISTRATION || to === GUEST_REGISTRATION)
      if (context.selfSignUp) expect(signUp.length).toBeGreaterThan(0)
      else expect(signUp).toStrictEqual([])
    }
  })

  test('the driving-rest rule is told only when arrival times come from the mock', () => {
    const routes = topicOf('routes')
    expect(routes.parts({ selfSignUp: false, mockRoutes: true })).toContain('restRule')
    expect(routes.parts({ selfSignUp: false, mockRoutes: false })).not.toContain('restRule')
  })
})
