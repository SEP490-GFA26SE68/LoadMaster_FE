/**
 * Tách chữ cho hệ hiện chữ của trang giới thiệu (`reveal/`), thuần — không React, không DOM. Mọi hàm chuẩn hoá NFC trước: chữ tiếng Việt
 * gõ kiểu tổ hợp ("a" + dấu rời) thành một ký tự, nên dấu không bao giờ rời khỏi chữ khi tách.
 */

/** Một từ và khoảng trắng đứng sau nó (rỗng ở từ cuối). Dấu câu dính vào từ. */
export type WordPart = { word: string; space: string }

/**
 * Tách theo khoảng trắng ngắt dòng được, giữ nguyên khoảng trắng: nối lại `word + space` của mọi phần là đúng chuỗi (đã NFC). Khoảng
 * trắng không ngắt (U+00A0, U+202F) nằm trong từ, nên từ ghép viết bằng nó ("thùng\u00a0xe") là một mảnh, không xuống dòng giữa chừng.
 */
export function words(text: string): WordPart[] {
  const tokens = text.normalize('NFC').split(/([^\S\u00a0\u202f]+)/)
  const parts: WordPart[] = []
  for (let i = 0; i < tokens.length; i += 2) {
    const word = tokens[i] ?? ''
    const space = tokens[i + 1] ?? ''
    if (word || space) parts.push({ word, space })
  }
  return parts
}

/** Tách theo grapheme (`Intl.Segmenter` sau NFC) để gõ chữ không tách dấu khỏi chữ; trình duyệt thiếu Segmenter thì theo code point. */
export function graphemes(text: string, locale: string): string[] {
  const nfc = text.normalize('NFC')
  if (typeof Intl.Segmenter !== 'function') return Array.from(nfc)
  return Array.from(new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(nfc), (part) => part.segment)
}

/** Nhịp gõ mỗi grapheme (ms): tối đa 22 ms, và cả câu không quá `budgetMs`. */
export function typeStep(count: number, budgetMs: number): number {
  return Math.min(22, budgetMs / Math.max(1, count))
}

/** Trần so le giữa hai từ của tiêu đề (ms): cả tiêu đề so le không quá 600 ms; CSS lấy `min` với `--stagger-word`. */
export function wordStagger(count: number): number {
  return count > 1 ? 600 / (count - 1) : 0
}

/** So le giữa hai từ của đoạn văn hiện dần (ms): tối đa 14 ms, cả đoạn không quá 500 ms. */
export function inkStagger(count: number): number {
  return Math.min(14, 500 / Math.max(1, count))
}

/** Mảnh của số lăn: một ô cho mỗi chữ số ASCII, chữ khác gộp thành một đoạn hiện dần. `cell` là số thứ tự ô (so le 60 ms mỗi ô). */
export type OdometerPart = { kind: 'digit'; digit: number; cell: number } | { kind: 'text'; text: string; cell: number }

/** Tách chuỗi số đã format theo ngôn ngữ ("0,1 cm", "< 1 giây") thành ô chữ số và đoạn chữ; đoạn chữ mang số ô đứng trước nó. */
export function odometerParts(value: string): OdometerPart[] {
  const parts: OdometerPart[] = []
  let cell = 0
  for (const char of value.normalize('NFC')) {
    if (char >= '0' && char <= '9') {
      parts.push({ kind: 'digit', digit: Number(char), cell })
      cell += 1
      continue
    }
    const last = parts.at(-1)
    if (last?.kind === 'text') last.text += char
    else parts.push({ kind: 'text', text: char, cell: Math.max(0, cell - 1) })
  }
  return parts
}
