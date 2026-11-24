import { useMutation } from '@tanstack/react-query'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { useT, type TFunction } from '@/lib/i18n'
import { askAssistant, type AssistantAskContext, type AssistantQuestion, type AssistantReply } from './assistant-api'
import type { AssistantContext } from './assistant-kb'
import { thinkingPace } from './assistant-pace'
import { assistantSession } from './assistant-session'
import { dispatchUiActions } from './viewer-bridge'

type Ask = AssistantQuestion & { readonly generation: number; readonly context: AssistantAskContext }

const current = (ask: Ask) => ask.generation === assistantSession.generation()

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Chữ chính của câu sẽ hiện, theo ngôn ngữ đang chọn — đúng câu khung chat vẽ (`AssistantLog`, `TopicAnswer`). Câu chủ đề chỉ tính câu
 * trả lời chính, không tính phần dựng từ dữ liệu (danh sách gói, các bước): đủ để nhịp tỉ lệ với độ dài thật.
 */
function replyText(reply: AssistantReply, t: TFunction, context: AssistantContext): string {
  switch (reply.kind) {
    case 'text':
      return reply.text
    case 'smallTalk':
      return t(`assistant.smallTalk.${reply.smallTalk}`, { name: LUMO_NAME })
    case 'fallback':
      return t('assistant.fallback')
    case 'topic':
      return reply.topicId === 'start' && context.selfSignUp ? t('assistant.topics.start.answerSelf') : t(`assistant.topics.${reply.topicId}.answer`)
  }
}

/**
 * Hỏi trợ lý. Câu trả lời ghi vào cuộc trò chuyện ở `onSuccess` / `onError` của chính mutation (không phải của từng lần `mutate`), nên
 * khách đóng khung chat giữa lúc chờ thì câu trả lời vẫn vào cuộc trò chuyện; khách đã "Bắt đầu lại" thì câu trả lời về muộn bị bỏ. Câu
 * của mô hình mang mã hội thoại: lượt sau nói tiếp hội thoại đó. Câu hỏi gửi từ Planner (kèm `viewer`) thì lệnh giao diện của câu trả lời
 * chuyển cho Planner qua `viewer-bridge.ts`. Không có khoá Query nào: câu trả lời không lưu ở cache.
 *
 * **Nhịp trả lời đặt ở đây, một chỗ** (`assistant-pace.ts`): câu trả lời — gõ, gợi ý hay "Hỏi Lumo chi tiết" — chỉ trả về khi đã qua
 * đích tính từ lúc gửi (2–6 giây theo độ dài câu hỏi và câu sẽ hiện), nên `pending` và hiệu ứng "đang trả lời" kéo dài tới đúng lúc câu
 * hiện. Câu về muộn hơn đích thì hiện ngay; lỗi báo ngay, không chờ. `answerContext` chọn đúng biến thể câu soạn sẵn đang hiện.
 */
export function useAskAssistantMutation(answerContext: AssistantContext) {
  const t = useT()
  return useMutation({
    mutationFn: async ({ question, topicId, escalate, context }: Ask) => {
      const sentAt = Date.now()
      const reply = await askAssistant({ question, topicId, ...(escalate ? { escalate } : {}) }, context)
      const remaining = sentAt + thinkingPace(question.length, replyText(reply, t, answerContext).length) - Date.now()
      if (remaining > 0) await wait(remaining)
      return reply
    },
    onSuccess: (reply, ask) => {
      if (!current(ask)) return
      if (reply.kind === 'text') {
        assistantSession.setConversationId(ask.context.surface, reply.conversationId)
        const { text, links, handoff, uiActions } = reply
        assistantSession.append({ kind: 'ai', text, links, handoff, uiActions })
        // Lệnh giao diện chạy đúng một lần, khi câu trả lời vừa về — không chạy lại khi mở lại khung chat hay dựng lại lịch sử.
        if (ask.context.viewer) dispatchUiActions(uiActions, ask.context.viewer.loadPlanId)
        return
      }
      if (reply.kind === 'smallTalk') {
        assistantSession.append({ kind: 'smallTalk', smallTalk: reply.smallTalk })
        return
      }
      const degraded = reply.degraded ? ({ degraded: true } as const) : {}
      if (reply.kind === 'fallback') {
        assistantSession.append({ kind: 'fallback', ...degraded })
        return
      }
      const question = reply.escalatable ? { question: ask.question } : {}
      assistantSession.append({ kind: 'answer', topicId: reply.topicId, ...degraded, ...question })
    },
    onError: (_error, ask) => {
      if (current(ask)) assistantSession.append({ kind: 'error' })
    },
    onSettled: (_reply, _error, ask) => {
      if (current(ask)) assistantSession.setPending(false)
    },
  })
}
