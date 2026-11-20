import { useNavigate } from 'react-router'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { usesBackend } from '@/lib/backend-config'
import { contactPath } from '../contact-form'
import { parseRuns } from './assistant-advisor'
import { handoffState } from './assistant-handoff'
import type { AssistantContext, TopicId } from './assistant-kb'
import { assistantSession } from './assistant-session'
import { useAskAssistantMutation } from './useAssistantQuery'

/** Giờ đến của app là mock tối ưu tuyến (có luật nghỉ bắt buộc) khi nhóm `trips` chưa nối máy chủ. */
const MOCK_ROUTES = !usesBackend('trips')

/** Điều câu trả lời phụ thuộc: khách tự đăng ký được (như `PlanCard`), giờ đến là của mock. */
export function useAssistantContext(): AssistantContext {
  const user = useAuthSafe()?.user
  return { selfSignUp: REGISTRATION_CAPABILITIES.publicSignUp && !user, mockRoutes: MOCK_ROUTES }
}

/**
 * Việc của khung chat: gửi câu hỏi (gõ hay bấm gợi ý — gợi ý gửi kèm chủ đề của nó), trả lời ngay phép tính gói khi trợ lý vừa hỏi số lần
 * chạy và khách gõ một số, và chuyển câu hỏi sang form liên hệ. `onLeave` đóng khung chat trước khi điều hướng (không trả focus về nút mở:
 * trang đích đặt focus vào tiêu đề phần).
 */
export function useAssistantChat(onLeave: () => void) {
  const { mutate } = useAskAssistantMutation()
  const navigate = useNavigate()

  function send(question: string, topicId?: TopicId) {
    const text = question.trim()
    const { pending, entries } = assistantSession.get()
    if (text === '' || pending) return
    const last = entries.at(-1)
    const runs = topicId === undefined && last?.kind === 'answer' && last.topicId === 'advisor' ? parseRuns(text) : null
    if (runs !== null) {
      assistantSession.append({ kind: 'user', text }, { kind: 'advisor', runs })
      return
    }
    assistantSession.append({ kind: 'user', text })
    assistantSession.setPending(true)
    mutate({ question: text, topicId, generation: assistantSession.generation() })
  }

  function sendRuns(label: string, runs: number) {
    if (assistantSession.get().pending) return
    assistantSession.append({ kind: 'user', text: label }, { kind: 'advisor', runs })
  }

  function handoff() {
    const questions = assistantSession.get().entries.flatMap((entry) => (entry.kind === 'user' ? [entry.text] : []))
    onLeave()
    void navigate(contactPath({ type: 'INQUIRY' }), { state: handoffState(questions) })
  }

  return { send, sendRuns, handoff }
}
