import type { Locale } from '@/lib/i18n'
import { normalizeSearchText } from '@/lib/list-filter'

/**
 * Bước chuẩn hoá chung của bộ khớp chủ đề (`assistant-match.ts`) và bộ định tuyến (`assistant-route.ts`), thuần: bỏ dấu, chữ thường, mọi
 * ký tự ngoài a–z 0–9 thành một khoảng trắng, rồi mở chữ viết tắt kiểu nhắn tin thành chữ đủ (bảng vi + en). Câu gợi ý không có chữ viết
 * tắt nào nên khớp như trước.
 */

/** Dạng so của một câu: bỏ dấu, chữ thường, chỉ còn chữ và số cách nhau một khoảng trắng. */
export function matchText(text: string): string {
  return normalizeSearchText(text).replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Chữ viết tắt không mơ hồ giữa hai ngôn ngữ (đã bỏ dấu: "đc" là "dc", "đt" là "dt"). */
const SHORTHAND: Readonly<Record<string, string>> = {
  // tiếng Việt
  ko: 'khong', k: 'khong', kh: 'khong', khg: 'khong', hk: 'khong', hok: 'khong', hong: 'khong', hem: 'khong', hun: 'khong',
  dc: 'duoc', dk: 'dang ky', dky: 'dang ky', j: 'gi', ji: 'gi', z: 'vay', zay: 'vay', dzay: 'vay', ntn: 'nhu the nao',
  bnh: 'bao nhieu', bh: 'bao gio', bgio: 'bao gio', cty: 'cong ty', mk: 'minh', mik: 'minh', mjk: 'minh', ns: 'noi',
  dt: 'dien thoai', tk: 'tai khoan', trc: 'truoc', ng: 'nguoi', nhiu: 'nhieu', mun: 'muon', xai: 'dung', cx: 'cung', cg: 'cung',
  nv: 'nhan vien', sp: 'san pham', ad: 'admin', oke: 'ok', okie: 'ok', oki: 'ok', okay: 'ok', okela: 'ok', okey: 'ok',
  // tiếng Anh
  thx: 'thanks', tks: 'thanks', thks: 'thanks', thanx: 'thanks', pls: 'please', plz: 'please', ur: 'your',
  wanna: 'want to', gonna: 'going to', abt: 'about',
}

/** Chữ viết tắt mỗi ngôn ngữ đọc một kiểu: "r" là "rồi" hay "are", "vs" là "với" hay "versus", "e" là "em", "u" là "you". */
const BY_LOCALE: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
  vi: { r: 'roi', vs: 'voi', v: 'vay', e: 'em' },
  en: { r: 'are', vs: 'versus', u: 'you' },
}

/** "bn" là "bạn" sau lời gọi, lời cảm ơn hay giới từ ("cảm ơn bn", "bn ơi"), còn lại là "bao nhiêu" ("giá bn"). */
const BN_AS_YOU_BEFORE = new Set(['oi', 'a'])
const BN_AS_YOU_AFTER = new Set(['chao', 'on', 'cho', 'voi', 'cua', 'giup', 'hoi'])

function expand(token: string, index: number, tokens: readonly string[], locale: Locale): string {
  if (token === 'bn') {
    const you = BN_AS_YOU_BEFORE.has(tokens[index + 1] ?? '') || BN_AS_YOU_AFTER.has(tokens[index - 1] ?? '')
    return you ? 'ban' : 'bao nhieu'
  }
  return BY_LOCALE[locale][token] ?? SHORTHAND[token] ?? token
}

/** Dạng so của câu gõ kiểu nhắn tin: `matchText` rồi mở chữ viết tắt. */
export function chatText(text: string, locale: Locale = 'vi'): string {
  const tokens = matchText(text).split(' ').filter((token) => token !== '')
  return tokens.map((token, index) => expand(token, index, tokens, locale)).join(' ')
}
