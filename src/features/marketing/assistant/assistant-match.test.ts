import { beforeAll, describe, expect, test } from 'vitest'
import { createTranslator, loadLocale } from '@/lib/i18n'
import { TOPIC_IDS } from './assistant-kb'
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
