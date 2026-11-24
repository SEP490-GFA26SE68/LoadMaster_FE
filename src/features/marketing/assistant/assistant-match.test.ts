import { beforeAll, describe, expect, test } from 'vitest'
import { createTranslator, loadLocale } from '@/lib/i18n'
import { TOPIC_IDS, TOPICS } from './assistant-kb'
import { chatText } from './assistant-chat-text'
import { matchText, matchTopic } from './assistant-match'

beforeAll(() => loadLocale('en'))

describe('matchTopic', () => {
  test('a typed question reaches its topic with or without Vietnamese accents', () => {
    expect(matchTopic('Giá các gói bao nhiêu tiền?')).toBe('plans')
    expect(matchTopic('gia cac goi bao nhieu tien')).toBe('plans')
    expect(matchTopic('Một lần tối ưu tốn bao nhiêu credit?')).toBe('credit')
    expect(matchTopic('Có quét mã QR khi xếp hàng không?')).toBe('verify')
    expect(matchTopic('Có kiểm tải trục không')).toBe('axle')
  })

  test('English questions reach the same topics', () => {
    expect(matchTopic('How much does it cost?')).toBe('plans')
    expect(matchTopic('Can I get a free trial?')).toBe('start')
    expect(matchTopic('Do drivers need a phone app?')).toBe('devices')
    expect(matchTopic('Can I talk to a real person?')).toBe('human')
  })

  test('the assistant answers who it is — it is not an AI', () => {
    expect(matchTopic('Bạn có phải AI không?')).toBe('about')
    expect(matchTopic('Are you AI?')).toBe('about')
    expect(matchTopic('Bạn là ai?')).toBe('about')
  })

  test('a keyword only matches whole words: "giao" is not "gia"', () => {
    expect(matchText('Giao hàng!')).toBe('giao hang')
    expect(matchTopic('giao')).toBeNull()
  })

  test('below the threshold there is no answer, not a guess', () => {
    expect(matchTopic('Thời tiết hôm nay thế nào?')).toBeNull()
    expect(matchTopic('xin chào')).toBeNull()
    expect(matchTopic('')).toBeNull()
    expect(matchTopic('???')).toBeNull()
  })

  test.each(['vi', 'en'] as const)('every suggested question (%s), typed by hand, reaches its own topic', (locale) => {
    const t = createTranslator(locale)
    for (const id of TOPIC_IDS) expect([id, matchTopic(t(`assistant.topics.${id}.chip`))]).toStrictEqual([id, id])
  })
})

describe('chatText', () => {
  test('chat shorthand opens into full words, by locale where it is ambiguous', () => {
    expect(chatText('gia goi bn')).toBe('gia goi bao nhieu')
    expect(chatText('cảm ơn bn nhé')).toBe('cam on ban nhe')
    expect(chatText('ko dc dk thử à')).toBe('khong duoc dang ky thu a')
    expect(chatText('r sao', 'vi')).toBe('roi sao')
    expect(chatText('r u free', 'en')).toBe('are you free')
    expect(matchTopic('gia goi bn')).toBe('plans')
  })

  test('every topic keyword and hint is already in normalized form, so shorthand never breaks a match', () => {
    for (const topic of TOPICS) {
      for (const phrase of [...topic.keywords, ...(topic.hints ?? [])]) {
        expect([topic.id, chatText(phrase, 'vi'), chatText(phrase, 'en')]).toStrictEqual([topic.id, phrase, phrase])
      }
    }
  })
})
