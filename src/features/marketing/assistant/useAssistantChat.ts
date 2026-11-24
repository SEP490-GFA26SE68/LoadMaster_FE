import { useLocation, useNavigate } from 'react-router'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { usesBackend } from '@/lib/backend-config'
import { useLocale } from '@/lib/i18n'
import { contactPath } from '../contact-form'
import { parseRuns } from './assistant-advisor'
import { ASSISTANT_USES_AI, type AssistantAskContext } from './assistant-api'
import { handoffState } from './assistant-handoff'
import type { AssistantContext, TopicId } from './assistant-kb'
import { assistantSession } from './assistant-session'
import { useAssistantSurface } from './assistant-surface'
import { useAskAssistantMutation } from './useAssistantQuery'
import { useBriefingQuery } from './useBriefingQuery'
import { viewerContext } from './viewer-bridge'

/** Giờ đến của app là mock tối ưu tuyến (có luật nghỉ bắt buộc) khi nhóm `trips` chưa nối máy chủ. */
const MOCK_ROUTES = !usesBackend('trips')

/** Điều câu trả lời phụ thuộc: khách tự đăng ký được (như `PlanCard`), giờ đến là của mock. */
export function useAssistantContext(): AssistantContext {
  const user = useAuthSafe()?.user
  return { selfSignUp: REGISTRATION_CAPABILITIES.publicSignUp && !user, mockRoutes: MOCK_ROUTES }
}

/**
 * Việc của khung chat: gửi câu hỏi (gõ hay bấm gợi ý — gợi ý gửi kèm chủ đề của nó), trả lời ngay phép tính gói khi trợ lý vừa hỏi số lần
 * chạy và khách gõ một số, chuyển câu hỏi sang form liên hệ, và đọc bản tin "Tóm tắt hôm nay" (trong ứng dụng, `useBriefingQuery`). Câu
 * gõ đi kèm bề mặt, ngôn ngữ, hội thoại đang nói tiếp, mã khách (trang công khai, khi nối máy chủ) và màn đang mở (trong ứng dụng).
 * `onLeave` đóng khung chat trước khi điều hướng (không trả focus về nút mở: trang đích đặt focus vào tiêu đề phần).
 */
export function useAssistantChat(onLeave: () => void) {
  const { mutate } = useAskAssistantMutation()
  const { request: briefing } = useBriefingQuery()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { locale } = useLocale()
  const surface = useAssistantSurface()

  function askContext(): AssistantAskContext {
    const viewer = surface === 'app' ? viewerContext() : null
    return {
      surface,
      locale,
      conversationId: assistantSession.conversationId(surface),
      guestKey: ASSISTANT_USES_AI && surface === 'public' ? assistantSession.guestKey() : null,
      ...(surface === 'app' ? { page: { path: `${pathname}${search}`, title: document.title } } : {}),
      ...(viewer === null ? {} : { viewer }),
    }
  }

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
    mutate({ question: text, topicId, generation: assistantSession.generation(), context: askContext() })
  }

  /** "Hỏi Lumo chi tiết": cùng câu khách đã hỏi, gửi thẳng cho mô hình (không thêm lượt hỏi mới vào cuộc trò chuyện). */
  function escalate(question: string, topicId: TopicId) {
    if (assistantSession.get().pending) return
    assistantSession.setPending(true)
    mutate({ question, topicId, escalate: true, generation: assistantSession.generation(), context: askContext() })
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

  return { send, escalate, sendRuns, handoff, briefing }
}
