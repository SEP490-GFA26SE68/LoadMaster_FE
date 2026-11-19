import { useMutation } from '@tanstack/react-query'
import { askAssistant, type AssistantQuestion } from './assistant-api'
import { assistantSession } from './assistant-session'

type Ask = AssistantQuestion & { readonly generation: number }

const current = (ask: Ask) => ask.generation === assistantSession.generation()

/**
 * Hỏi trợ lý. Câu trả lời ghi vào cuộc trò chuyện ở `onSuccess` / `onError` của chính mutation (không phải của từng lần `mutate`), nên
 * khách đóng khung chat giữa lúc chờ thì câu trả lời vẫn vào cuộc trò chuyện; khách đã "Bắt đầu lại" thì câu trả lời về muộn bị bỏ. Không
 * có khoá Query nào: câu trả lời không lưu ở cache.
 */
export function useAskAssistantMutation() {
  return useMutation({
    mutationFn: ({ question, topicId }: Ask) => askAssistant({ question, topicId }),
    onSuccess: (reply, ask) => {
      if (!current(ask)) return
      assistantSession.append(reply.kind === 'topic' ? { kind: 'answer', topicId: reply.topicId } : { kind: 'fallback' })
    },
    onError: (_error, ask) => {
      if (current(ask)) assistantSession.append({ kind: 'error' })
    },
    onSettled: (_reply, _error, ask) => {
      if (current(ask)) assistantSession.setPending(false)
    },
  })
}
