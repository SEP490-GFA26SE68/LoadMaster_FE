import { describe, expect, test } from 'vitest'
import { en } from './en'
import { LOCALES } from './locale'
import type { MessageTree } from './types'
import { vi } from './vi'

/**
 * Lời của Lumo và câu của dải nguyên tắc trên trang giới thiệu (nhánh `landingStory`, AGENTS mục 1, 5): không chữ số — số chỉ hiện ở chỗ
 * có nguồn —; lời dẫn khung 3D tối đa 80 grapheme (gõ xong trong một giây), câu khác tối đa 120; không mời đăng ký, mua gói hay dùng thử
 * (tài khoản công ty do đội LoadMaster mở sau khi khách liên hệ); tên Lumo không nằm trong từ điển mà đi qua tham số `{name}`.
 */
const STORIES = { vi: vi.landingStory, en: en.landingStory } as const

const BANNED = { vi: /đăng ký|mua gói|dùng thử/iu, en: /sign up|buy|free trial/i } as const

const HERO_MAX = 80
const LINE_MAX = 120

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** Số grapheme sau NFC: dấu tiếng Việt viết tách (e + dấu) vẫn là một chữ. */
function graphemes(text: string): number {
  return [...segmenter.segment(text.normalize('NFC'))].length
}

/** Mọi câu của nhánh kèm đường key, theo thứ tự khai báo: `['lumo.hero.ready', '…']`. */
function linesOf(tree: MessageTree, prefix = ''): (readonly [string, string])[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value] as const] : linesOf(value, `${prefix}${key}.`),
  )
}

test('the branch has the lines the landing page reads, in both languages', () => {
  const keys = [
    'lumo.says',
    'lumo.hero.preparing', 'lumo.hero.intake', 'lumo.hero.optimize', 'lumo.hero.loading', 'lumo.hero.ready', 'lumo.hero.readyPartial',
    'lumo.hero.fallback',
    'lumo.facts',
    'lumo.how.intake', 'lumo.how.plan', 'lumo.how.optimize', 'lumo.how.operate', 'lumo.how.done',
    'lumo.plans',
    'lumo.contact',
    'statement',
  ]
  for (const locale of LOCALES) expect(linesOf(STORIES[locale]).map(([key]) => key)).toStrictEqual(keys)
})

describe.each(LOCALES)('landingStory (%s)', (locale) => {
  const lines = linesOf(STORIES[locale])

  test('no digit in what Lumo says nor in the statement', () => {
    expect(lines.filter(([, text]) => /\d/.test(text))).toStrictEqual([])
  })

  test(`hero lines fit in ${HERO_MAX} graphemes, the other lines in ${LINE_MAX}`, () => {
    const tooLong = lines
      .map(([key, text]) => [key, graphemes(text)] as const)
      .filter(([key, length]) => length > (key.startsWith('lumo.hero.') ? HERO_MAX : LINE_MAX))
    expect(tooLong).toStrictEqual([])
  })

  test('no sign-up, purchase or free-trial wording', () => {
    expect(lines.filter(([, text]) => BANNED[locale].test(text.normalize('NFC')))).toStrictEqual([])
  })

  test('the mascot name comes from the {name} parameter, never from the dictionary', () => {
    expect(STORIES[locale].lumo.says).toContain('{name}')
    expect(lines.filter(([, text]) => /lumo/i.test(text))).toStrictEqual([])
  })
})

test('the grapheme count keeps Vietnamese marks on their letters', () => {
  expect(graphemes('Tận dụng')).toBe(8)
  expect(graphemes('Tận dụng')).toBe(8)
})
