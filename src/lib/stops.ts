/**
 * 8 màu định danh điểm giao — bảng Okabe–Ito, an toàn cho người mù màu.
 * Chỉ dùng để định danh điểm giao, không dùng trang trí (AGENTS.md mục 5).
 * Màu luôn đi kèm nhãn hoặc số, không bao giờ chỉ dựa vào màu (mục 10).
 */

export const STOP_COLORS = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#555555',
] as const

export const STOP_COUNT = STOP_COLORS.length

/**
 * Màu nền cần chữ tối: mọi màu trừ #0072B2 và #555555. Chọn theo tương phản cao hơn — chữ trắng trên #009E73, #D55E00, #CC79A7 chỉ
 * 3,1–3,9:1, dưới 4,5:1 (mục 10); chữ tối đạt 4,6–5,8:1 (V2.3: "chữ trên mốc luôn tối", trang /kieu-dang đo ra).
 */
const DARK_TEXT_ON = new Set<string>(['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#D55E00', '#CC79A7'])

/** Chỉ số điểm giao (1-based) → mã màu nền. Vượt quá 8 thì quay vòng. */
export function stopColor(stopNumber: number): string {
  const index = (stopNumber - 1) % STOP_COUNT
  return STOP_COLORS[index] ?? STOP_COLORS[0]
}

/** Chỉ số điểm giao (1-based) → màu chữ tương phản trên nền màu đó. */
export function stopForeground(stopNumber: number): string {
  return DARK_TEXT_ON.has(stopColor(stopNumber)) ? '#111827' : '#FFFFFF'
}
