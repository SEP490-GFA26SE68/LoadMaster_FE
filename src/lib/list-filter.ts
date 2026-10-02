/**
 * Hàm thuần cho danh sách có tìm, lọc, sắp xếp (LM-085, D-52). Màn tự lọc dữ liệu bằng các hàm này rồi mới đưa vào
 * `DataTable`; bảng chỉ sắp xếp và phân trang.
 *
 * - Tìm không phân biệt dấu và hoa thường: gõ "bien hoa" khớp "Biên Hoà" (và cả cách đặt dấu cũ "Biên Hòa").
 * - Ngày dạng `YYYY-MM-DD` so theo chuỗi: cùng định dạng thì thứ tự chuỗi là thứ tự ngày.
 * - Chữ sắp theo bảng chữ cái tiếng Việt (D trước Đ, O trước Ô trước Ơ), số trong chuỗi theo giá trị (PKG-2 trước PKG-10).
 */

/** Dấu thanh và dấu mũ/móc/trăng sau khi tách NFD đều là ký tự kết hợp (nhóm Unicode Mark). */
const COMBINING_MARKS = /\p{M}/gu

/**
 * Đ/đ (U+0110, U+0111) là chữ riêng, NFD không tách ra D + dấu nên phải đổi tay. Dựng từ mã số để file mã nguồn không
 * chứa chữ có dấu (cổng `no-hardcoded-vietnamese`).
 */
const D_WITH_STROKE = new RegExp(`[${String.fromCodePoint(0x110, 0x111)}]`, 'g')

const WHITESPACE = /\s+/g

/** Chữ để so khi tìm: bỏ dấu, đổi đ → d, chữ thường, gộp khoảng trắng. "  Thủ   Đức " → "thu duc". */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(D_WITH_STROKE, 'd')
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim()
}

/**
 * Dòng khớp từ khoá khi **mọi** từ của từ khoá có trong ít nhất một trường, không kể thứ tự: "0914 bien hoa" khớp
 * mã `TRIP-2026-0914` cùng tuyến "… – Biên Hoà". Từ khoá rỗng khớp mọi dòng.
 */
export function matchesQuery(fields: string | readonly (string | null | undefined)[], query: string): boolean {
  const terms = normalizeSearchText(query).split(' ').filter((term) => term !== '')
  if (terms.length === 0) return true
  const text = typeof fields === 'string'
    ? normalizeSearchText(fields)
    : fields.map((field) => normalizeSearchText(field ?? '')).join(' ')
  return terms.every((term) => text.includes(term))
}

/** Chữ bắt đầu bằng từ khoá (cùng cách bỏ dấu của `matchesQuery`): xếp gợi ý "khớp từ đầu tên" lên trước (FE-4b-03). Từ khoá rỗng là `false`. */
export function startsWithQuery(text: string, query: string): boolean {
  const wanted = normalizeSearchText(query)
  return wanted !== '' && normalizeSearchText(text).startsWith(wanted)
}

/** Ô `type="date"` cho gõ năm tới 6 chữ số; năm như vậy so theo chuỗi sẽ sai ("102026" < "2026"). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Ngày `YYYY-MM-DD` nằm trong khoảng, tính cả hai đầu. Đầu rỗng hoặc sai dạng (gõ nhầm năm, URL sửa tay) là không
 * giới hạn. Thời điểm ISO (nhật ký) phải đổi sang ngày giờ Việt Nam trước (`vnDate` của kho), không cắt chuỗi UTC.
 */
export function isWithinDateRange(date: string, from = '', to = ''): boolean {
  return (!ISO_DATE.test(from) || date >= from) && (!ISO_DATE.test(to) || date <= to)
}

const VIETNAMESE_ORDER = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' })

/** So sánh tăng dần cho cột chữ: thứ tự chữ cái tiếng Việt, số trong chuỗi so theo giá trị. */
export function compareText(a: string, b: string): number {
  return VIETNAMESE_ORDER.compare(a, b)
}
