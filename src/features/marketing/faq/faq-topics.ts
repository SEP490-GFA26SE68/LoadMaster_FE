import type { TopicId } from '../assistant/assistant-kb'

/** Neo của phần Hỏi đáp trên trang giới thiệu (`/gioi-thieu#hoi-dap`) — chân trang trỏ tới đây. */
export const FAQ_ANCHOR = 'hoi-dap'

/**
 * Sáu chủ đề của bộ câu trả lời mà phần Hỏi đáp hiện, theo thứ tự đọc: câu hỏi là `chip`, câu trả lời là chính câu trả lời của trợ lý Lumo
 * (`TopicAnswer`) — một nguồn chữ, không viết câu trả lời thứ hai. Không lấy những chủ đề trang đã nói ở phần bên cạnh (gói cước, năm chặng
 * của một chuyến hàng), chủ đề cần hỏi lại (tư vấn gói theo số lần chạy) và chủ đề nói về chính khung chat (hỏi người thật, Lumo là ai).
 */
export const FAQ_TOPICS = ['start', 'credit', 'roles', 'packages', 'tenancy', 'support'] as const satisfies readonly TopicId[]
