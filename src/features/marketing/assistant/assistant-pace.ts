/**
 * Nhịp trả lời của trợ lý "Hỏi Lumo": câu trả lời hiện sau 2–6 giây **tính từ lúc gửi**, dài theo câu hỏi và câu trả lời, để hiệu ứng
 * "Lumo đang trả lời…" (chấm, dải gradient, vạch dưới đầu khung, vòng ảnh) chạy đủ cho người đọc thấy. Đây là thời gian **tối thiểu**:
 * câu trả lời về muộn hơn đích thì hiện ngay, không chờ thêm (`useAskAssistantMutation` đo thời gian thật đã trôi).
 *
 * Thuần, không import gì — app di động chép nguyên file này (`pnpm sync:web` của repo mobile) và dùng cùng nhịp.
 */

export const THINKING_MIN_MS = 2_000
export const THINKING_MAX_MS = 6_000
/** Mỗi ký tự của câu hỏi thêm 10 ms: đọc câu dài hơn. */
export const THINKING_MS_PER_QUESTION_CHAR = 10
/** Mỗi ký tự của câu sẽ hiện thêm 6 ms: soạn câu dài hơn. */
export const THINKING_MS_PER_ANSWER_CHAR = 6

const chars = (count: number) => (Number.isFinite(count) && count > 0 ? count : 0)

/** Đích của nhịp, tính từ lúc gửi: 2.000 + 10 × ký tự câu hỏi + 6 × ký tự câu trả lời, chặn trong [2.000, 6.000] ms. */
export function thinkingDelayMs(questionChars: number, answerChars: number): number {
  const raw = THINKING_MIN_MS + THINKING_MS_PER_QUESTION_CHAR * chars(questionChars) + THINKING_MS_PER_ANSWER_CHAR * chars(answerChars)
  return Math.round(Math.min(THINKING_MAX_MS, Math.max(THINKING_MIN_MS, raw)))
}

type Pace = (questionChars: number, answerChars: number) => number

let pace: Pace = thinkingDelayMs

/** Nhịp đang dùng — `thinkingDelayMs`, trừ khi test đã thay. */
export function thinkingPace(questionChars: number, answerChars: number): number {
  return pace(questionChars, answerChars)
}

/**
 * Chỉ cho test: thay nhịp (`src/test/setup-dom.ts` đặt nhịp 0 để test DOM của khung chat không chậm đi 2–6 giây mỗi câu); `null` trả
 * về `thinkingDelayMs`.
 */
export function setThinkingPace(next: Pace | null): void {
  pace = next ?? thinkingDelayMs
}
