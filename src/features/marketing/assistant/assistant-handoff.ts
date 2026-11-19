import { CONTACT_LIMITS } from '@/lib/mock-db'

/**
 * Chuyển câu hỏi của khách từ trợ lý sang form liên hệ (thuần). Câu hỏi đi trong `state` của điều hướng (react-router), không lên URL;
 * `ContactSection` đọc một lần cho mỗi lần điều hướng và điền sẵn ô nội dung: dòng mở đầu rồi tối đa năm câu hỏi gần nhất, mỗi câu một dòng
 * "- …", cắt vừa giới hạn của ô nội dung.
 */
export const HANDOFF_MAX_QUESTIONS = 5

export type HandoffState = { readonly assistantHandoff: { readonly questions: readonly string[] } }

export function handoffState(questions: readonly string[]): HandoffState {
  return { assistantHandoff: { questions: questions.slice(-HANDOFF_MAX_QUESTIONS) } }
}

/** Câu hỏi mang theo trong `location.state`; state khác hình thì `null`. */
export function handoffQuestionsOf(state: unknown): readonly string[] | null {
  if (typeof state !== 'object' || state === null || !('assistantHandoff' in state)) return null
  const handoff: unknown = state.assistantHandoff
  if (typeof handoff !== 'object' || handoff === null || !('questions' in handoff)) return null
  const questions: unknown = handoff.questions
  if (!Array.isArray(questions)) return null
  return questions.filter((question): question is string => typeof question === 'string' && question.trim() !== '')
}

export function handoffMessage(intro: string, questions: readonly string[], max: number = CONTACT_LIMITS.message): string {
  const lines = questions.slice(-HANDOFF_MAX_QUESTIONS).map((question) => `- ${question.trim()}`)
  return [intro, ...lines].join('\n').slice(0, max)
}
