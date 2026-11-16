/**
 * 8 màu định danh điểm giao — bảng Okabe–Ito, an toàn cho người mù màu.
 * Chỉ dùng để định danh điểm giao, không dùng trang trí (AGENTS.md mục 5).
 * Màu luôn đi kèm nhãn hoặc số, không bao giờ chỉ dựa vào màu (mục 10).
 *
 * Đây là bản số duy nhất của token `--stop-1` … `--stop-8` (`src/index.css`): Three.js, hình SVG tính sắc độ (tô theo kiện gốc,
 * ảnh thu nhỏ) cần mã màu thật chứ không nhận `var()`. `stops.test.ts` đọc `index.css` và đỏ khi hai nơi lệch nhau.
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
 * Chữ trên mốc: tối (`--ink-strong`) trên mọi màu trừ điểm 5 và 8. Chọn theo tương phản cao hơn — chữ trắng trên điểm 3, 6, 7 chỉ
 * 3,1–3,9:1, dưới 4,5:1 (mục 10); chữ tối đạt 4,5–5,8:1 (V2.3: "chữ trên mốc luôn tối", trang /kieu-dang đo ra).
 */
const LIGHT_TEXT_STOPS = new Set([5, 8])

export type StopForegroundToken = '--ink-strong' | '--bg'

/** Chỉ số điểm giao (1-based) → mã màu nền. Vượt quá 8 thì quay vòng. */
export function stopColor(stopNumber: number): string {
  return STOP_COLORS[stopIndex(stopNumber)] ?? STOP_COLORS[0]
}

/** Token của chữ tương phản trên mốc điểm giao (trang /kieu-dang đọc nó để đo tương phản). */
export function stopForegroundToken(stopNumber: number): StopForegroundToken {
  return LIGHT_TEXT_STOPS.has(stopIndex(stopNumber) + 1) ? '--bg' : '--ink-strong'
}

/** Chỉ số điểm giao (1-based) → màu chữ tương phản trên nền màu đó, dạng `var(--…)` cho `style` và thuộc tính SVG. */
export function stopForeground(stopNumber: number): string {
  return `var(${stopForegroundToken(stopNumber)})`
}

function stopIndex(stopNumber: number): number {
  return (((stopNumber - 1) % STOP_COUNT) + STOP_COUNT) % STOP_COUNT
}
