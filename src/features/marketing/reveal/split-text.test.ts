import { describe, expect, it } from 'vitest'
import { flowStagger, flowWords, graphemes, odometerParts, sentences, typeStep, words, wordStagger } from './split-text'

/** "Tận dụng" gõ kiểu tổ hợp: chữ gốc kèm dấu rời (U+0323 nặng, U+0302 mũ…), như chép từ một số bộ gõ. */
const DECOMPOSED = 'Tận dụng'

describe('words', () => {
  it('giữ đúng khoảng trắng: nối lại là đúng chuỗi', () => {
    const text = 'Hàng giao sau  lên xe\ttrước.'
    expect(words(text).map((part) => part.word + part.space).join('')).toBe(text)
    expect(words(text).map((part) => part.word)).toEqual(['Hàng', 'giao', 'sau', 'lên', 'xe', 'trước.'])
    expect(words('a b').at(-1)).toEqual({ word: 'b', space: '' })
  })

  it('khoảng trắng đầu chuỗi thành phần không có từ, chuỗi rỗng không có phần nào', () => {
    expect(words(' a ')).toEqual([{ word: '', space: ' ' }, { word: 'a', space: ' ' }])
    expect(words('')).toEqual([])
  })

  it('khoảng trắng không ngắt (U+00A0, U+202F) ở trong từ: từ ghép là một mảnh', () => {
    const text = 'Tận dụng thùng xe, dỡ đúng thứ tự.'
    expect(words(text).map((part) => part.word)).toEqual(['Tận', 'dụng', 'thùng xe,', 'dỡ', 'đúng', 'thứ tự.'])
    expect(words(text).map((part) => part.word + part.space).join('')).toBe(text)
    expect(words(' ')).toEqual([{ word: ' ', space: '' }])
  })

  it('chuẩn hoá NFC: từ gõ kiểu tổ hợp thành chữ dựng sẵn', () => {
    expect(DECOMPOSED).not.toBe('Tận dụng')
    expect(words(DECOMPOSED).map((part) => part.word)).toEqual(['Tận', 'dụng'])
  })
})

describe('graphemes', () => {
  it('dấu không rời khỏi chữ, kể cả khi chuỗi gõ kiểu tổ hợp', () => {
    expect(graphemes(DECOMPOSED, 'vi')).toEqual(['T', 'ậ', 'n', ' ', 'd', 'ụ', 'n', 'g'])
    expect(graphemes('Tận dụng', 'vi')).toEqual(graphemes(DECOMPOSED, 'vi'))
  })
})

describe('nhịp và so le', () => {
  it('gõ cả câu không quá ngân sách, mỗi grapheme tối đa 22 ms', () => {
    for (const [count, budget] of [[0, 1000], [1, 1000], [12, 1000], [80, 1000], [120, 1400], [500, 1400]] as const) {
      expect(typeStep(count, budget) * count).toBeLessThanOrEqual(budget)
      expect(typeStep(count, budget)).toBeLessThanOrEqual(22)
    }
    expect(typeStep(10, 1400)).toBe(22)
  })

  it('so le của tiêu đề có trần', () => {
    expect(wordStagger(1)).toBe(0)
    expect(wordStagger(16) * 15).toBe(600)
  })
})

describe('odometerParts', () => {
  it('mỗi chữ số một ô, chữ khác gộp thành đoạn mang số ô đứng trước', () => {
    expect(odometerParts('0,1 cm')).toEqual([
      { kind: 'digit', digit: 0, cell: 0 },
      { kind: 'text', text: ',', cell: 0 },
      { kind: 'digit', digit: 1, cell: 1 },
      { kind: 'text', text: ' cm', cell: 1 },
    ])
    expect(odometerParts('< 1 giây')).toEqual([
      { kind: 'text', text: '< ', cell: 0 },
      { kind: 'digit', digit: 1, cell: 0 },
      { kind: 'text', text: ' giây', cell: 0 },
    ])
    expect(odometerParts('10').map((part) => part.kind)).toEqual(['digit', 'digit'])
  })
})

describe('sentences', () => {
  it('mỗi câu một phần theo ngôn ngữ, bỏ khoảng trắng hai đầu và phần rỗng', () => {
    const text = 'Hàng giao sau lên xe trước. Hàng giao trước nằm sát cửa. Tới điểm nào, lấy hàng điểm đó.'
    expect(sentences(text, 'vi')).toEqual(['Hàng giao sau lên xe trước.', 'Hàng giao trước nằm sát cửa.', 'Tới điểm nào, lấy hàng điểm đó.'])
    expect(sentences('  One line only  ', 'en')).toEqual(['One line only'])
    expect(sentences('   ', 'en')).toEqual([])
  })

  it('chuẩn hoá NFC trước khi tách', () => {
    expect(sentences(`${DECOMPOSED}. Xong.`, 'vi')).toEqual(['Tận dụng.', 'Xong.'])
  })
})

describe('flowWords', () => {
  it('mỗi từ thành grapheme, đếm liên tục qua các từ; dấu không rời chữ, khoảng trắng không ngắt ở trong từ', () => {
    const { parts, count } = flowWords(`${DECOMPOSED} xe, dỡ`, 'vi')
    expect(parts).toEqual([
      { chars: ['T', 'ậ', 'n'], space: ' ', start: 0 },
      { chars: ['d', 'ụ', 'n', 'g', ' ', 'x', 'e', ','], space: ' ', start: 3 },
      { chars: ['d', 'ỡ'], space: '', start: 11 },
    ])
    expect(count).toBe(13)
    expect(flowWords('', 'vi')).toEqual({ parts: [], count: 0 })
  })

  it('so le giữa hai grapheme có trần: 26 ms, cả tiêu đề không quá 720 ms', () => {
    expect(flowStagger(1)).toBe(0)
    expect(flowStagger(10)).toBe(26)
    expect(flowStagger(61) * 60).toBe(720)
  })
})
