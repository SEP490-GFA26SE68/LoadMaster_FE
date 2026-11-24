import { useMutation } from '@tanstack/react-query'
import { askAssistant, type AssistantAskContext, type AssistantQuestion } from './assistant-api'
import { assistantSession } from './assistant-session'
import { dispatchUiActions } from './viewer-bridge'

type Ask = AssistantQuestion & { readonly generation: number; readonly context: AssistantAskContext }

const current = (ask: Ask) => ask.generation === assistantSession.generation()

/**
 * Hỏi trợ lý. Câu trả lời ghi vào cuộc trò chuyện ở `onSuccess` / `onError` của chính mutation (không phải của từng lần `mutate`), nên
 * khách đóng khung chat giữa lúc chờ thì câu trả lời vẫn vào cuộc trò chuyện; khách đã "Bắt đầu lại" thì câu trả lời về muộn bị bỏ. Câu
 * của mô hình mang mã hội thoại: lượt sau nói tiếp hội thoại đó. Câu hỏi gửi từ Planner (kèm `viewer`) thì lệnh giao diện của câu trả lời
 * chuyển cho Planner qua `viewer-bridge.ts`. Không có khoá Query nào: câu trả lời không lưu ở cache.
 */
export function useAskAssistantMutation() {
  return useMutation({
    mutationFn: ({ question, topicId, escalate, context }: Ask) => askAssistant({ question, topicId, ...(escalate ? { escalate } : {}) }, context),
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
