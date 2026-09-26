/**
 * Tỷ lệ tương phản WCAG 2.x cho bảng "Tương phản đã kiểm" ở `/kieu-dang`. Hàm thuần: trang đọc giá trị token lúc chạy rồi tính ở đây,
 * không ghi tay tỷ lệ nào — đổi token trong `src/index.css` là bảng tự đổi theo.
 */

type Rgb = readonly [number, number, number]

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const RGB = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i

/** `#rgb`, `#rrggbb`, `rgb()`/`rgba()` (bỏ qua alpha) → ba kênh 0–255. Chuỗi khác (rỗng, gradient, `var()`) → `null`. */
export function parseColor(value: string): Rgb | null {
  const text = value.trim()
  const hex = HEX.exec(text)?.[1]
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex
    const byte = (start: number) => Number.parseInt(full.slice(start, start + 2), 16)
    return [byte(0), byte(2), byte(4)]
  }
  const rgb = RGB.exec(text)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Độ chói tương đối theo WCAG 2.x. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Tỷ lệ tương phản của hai màu (thứ tự không quan trọng), 1–21. Một trong hai không đọc được → `null`. */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseColor(foreground)
  const bg = parseColor(background)
  if (!fg || !bg) return null
  const a = relativeLuminance(fg)
  const b = relativeLuminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
