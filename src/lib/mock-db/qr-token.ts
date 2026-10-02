/**
 * Mã trên nhãn QR (LM-104): `LM-XXXX-XXXX-XXXX`, 12 ký tự Crockford base32 (không có I, L, O, U để đọc chép tay không nhầm). Mã là
 * chuỗi ngẫu nhiên **không chứa dữ liệu kiện** — kho tra ngược mã → kiện, như backend sẽ làm. Hàm thuần.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const LENGTH = 12
/** Thân mã: đúng 12 ký tự của bảng chữ trên. */
const BODY = /^[0-9A-HJKMNP-TV-Z]{12}$/

/** Dạng chuẩn để so: bỏ khoảng trắng, viết hoa; thêm tiền tố và gạch nối khi người dùng gõ thiếu. */
export function normalizeQrToken(input: string): string {
  const cleaned = input.replace(/\s+/g, '').toUpperCase()
  const compact = cleaned.replace(/^LM-?/, '').replaceAll('-', '')
  return BODY.test(compact) ? formatBody(compact) : cleaned
}

function formatBody(body: string): string {
  return `LM-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`
}

/** Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32): seed và test tất định. Trả số trong [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Mã mới từ nguồn ngẫu nhiên; `taken` là mã đã cấp, gặp trùng thì sinh lại. */
export function randomQrToken(random: () => number, taken: (token: string) => boolean = () => false): string {
  for (;;) {
    let body = ''
    for (let index = 0; index < LENGTH; index++) body += ALPHABET[Math.floor(random() * ALPHABET.length)]
    const token = formatBody(body)
    if (!taken(token)) return token
  }
}
