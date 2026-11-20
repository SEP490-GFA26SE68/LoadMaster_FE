import { useMutation } from '@tanstack/react-query'
import { askAssistant, type AssistantAskContext, type AssistantQuestion } from './assistant-api'
import { assistantSession } from './assistant-session'

type Ask = AssistantQuestion & { readonly generation: number; readonly context: AssistantAskContext }

const current = (ask: Ask) => ask.generation === assistantSession.generation()

/**
 * Hỏi trợ lý. Câu trả lời ghi vào cuộc trò chuyện ở `onSuccess` / `onError` của chính mutation (không phải của từng lần `mutate`), nên
 * khách đóng khung chat giữa lúc chờ thì câu trả lời vẫn vào cuộc trò chuyện; khách đã "Bắt đầu lại" thì câu trả lời về muộn bị bỏ. Câu
 * của mô hình mang mã hội thoại: lượt sau nói tiếp hội thoại đó. Không có khoá Query nào: câu trả lời không lưu ở cache.
 */
export function useAskAssistantMutation() {
  return useMutation({
    mutationFn: ({ question, topicId, context }: Ask) => askAssistant({ question, topicId }, context),
    onSuccess: (reply, ask) => {
      if (!current(ask)) return
      if (reply.kind === 'text') {
        assistantSession.setConversationId(ask.context.surface, reply.conversationId)
        const { text, links, handoff, uiActions } = reply
        assistantSession.append({ kind: 'ai', text, links, handoff, uiActions })
        return
      }
      const degraded = reply.degraded ? ({ degraded: true } as const) : {}
      assistantSession.append(reply.kind === 'topic' ? { kind: 'answer', topicId: reply.topicId, ...degraded } : { kind: 'fallback', ...degraded })
    },
    onError: (_error, ask) => {
      if (current(ask)) assistantSession.append({ kind: 'error' })
    },
    onSettled: (_reply, _error, ask) => {
      if (current(ask)) assistantSession.setPending(false)
    },
  })
}
