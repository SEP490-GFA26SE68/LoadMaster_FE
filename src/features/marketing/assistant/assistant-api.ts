import { matchTopic } from './assistant-match'
import type { TopicId } from './assistant-kb'

/**
 * Lớp mạng của trợ lý "Hỏi Lumo" — nơi duy nhất biết câu trả lời đến từ đâu.
 *
 * | Hàm            | Endpoint                                          |
 * |----------------|---------------------------------------------------|
 * | `askAssistant` | `POST /api/assistant/messages` — chưa có ở BE     |
 *
 * Chưa có backend: khớp câu hỏi với bộ câu trả lời soạn sẵn ở trình duyệt (`assistant-match.ts`) sau một khoảng trễ ngắn — đủ cho dòng
 * "đang trả lời", không lâu tới mức làm khách chờ. Nút gợi ý gửi kèm `topicId` của nó nên trả đúng chủ đề đó.
 */
export const ASSISTANT_DELAY_MS = 500

export type AssistantQuestion = { readonly question: string; readonly topicId?: TopicId }
export type AssistantReply = { readonly kind: 'topic'; readonly topicId: TopicId } | { readonly kind: 'fallback' }

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// POST /api/assistant/messages — chưa có ở BE
export async function askAssistant(input: AssistantQuestion): Promise<AssistantReply> {
  await wait(ASSISTANT_DELAY_MS)
  const topicId = input.topicId ?? matchTopic(input.question)
  return topicId === null ? { kind: 'fallback' } : { kind: 'topic', topicId }
}
