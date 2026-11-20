import { api, isApiError, isTransientApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import type { Locale } from '@/lib/i18n'
import type { AssistantMessageRequestDto, AssistantPublicMessageRequestDto, AssistantReplyDto } from './assistant-dto'
import type { TopicId } from './assistant-kb'
import { matchTopic } from './assistant-match'

/**
 * Lớp mạng của trợ lý "Hỏi Lumo" — nơi duy nhất biết câu trả lời đến từ đâu.
 *
 * | Hàm            | Endpoint                                                                    |
 * |----------------|-----------------------------------------------------------------------------|
 * | `askAssistant` | `POST /api/assistant/public/messages` · `POST /api/assistant/messages`      |
 *
 * Nhóm `assistant` chưa nối máy chủ (kho mẫu): khớp câu hỏi với bộ câu trả lời soạn sẵn ở trình duyệt (`assistant-match.ts`) sau một
 * khoảng trễ ngắn — đủ cho dòng "đang trả lời", không lâu tới mức làm khách chờ. Nối máy chủ: câu gõ đi tới mô hình; câu gợi ý (gửi kèm
 * `topicId`) vẫn trả câu soạn sẵn của chủ đề đó. Máy chủ bận, hết ngân sách (`ASSISTANT_*`) hay không tới được thì trả câu soạn sẵn kèm
 * `degraded` để màn nói rõ; lỗi khác ném ra như mọi lượt gọi.
 */
export const ASSISTANT_DELAY_MS = 500
/** Một lượt trả lời có thể gọi công cụ vài vòng: chờ lâu hơn giới hạn mặc định của client. */
export const ASSISTANT_TIMEOUT_MS = 45_000

const ON_BACKEND = usesBackend('assistant')

/** Câu trả lời đến từ mô hình (nhóm `assistant` nối máy chủ) hay từ bộ câu trả lời soạn sẵn. */
export const ASSISTANT_USES_AI = ON_BACKEND

/** Trang công khai (khách, mã khách) hay trong ứng dụng (người đã đăng nhập). */
export type AssistantSurface = 'public' | 'app'

export type AssistantQuestion = { readonly question: string; readonly topicId?: TopicId }

export type AssistantAskContext = {
  readonly surface: AssistantSurface
  readonly locale: Locale
  /** Hội thoại đang nói tiếp với máy chủ; `null` mở hội thoại mới. */
  readonly conversationId: string | null
  /** Mã khách của phiên trình duyệt — bắt buộc ở trang công khai khi nối máy chủ. */
  readonly guestKey: string | null
  readonly page?: { readonly path: string; readonly title: string }
}

/** Lệnh giao diện cho màn 3D (kỹ năng hỏi về phương án). */
export type UiAction = {
  readonly type: string
  readonly packageCode?: string
  readonly preset?: string
  readonly step?: number
  readonly mode?: string
  readonly tab?: string
}

export type AssistantLink = { readonly label: string; readonly to: string }
export type AssistantHandoff = { readonly offered: boolean; readonly ticketCode: string | null }

export type AssistantReply =
  | { readonly kind: 'topic'; readonly topicId: TopicId; readonly degraded: boolean }
  | { readonly kind: 'fallback'; readonly degraded: boolean }
  | {
      readonly kind: 'text'
      readonly conversationId: string
      readonly text: string
      readonly uiActions: readonly UiAction[]
      readonly links: readonly AssistantLink[]
      readonly handoff: AssistantHandoff
    }

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function prepared(input: AssistantQuestion, degraded: boolean): AssistantReply {
  const topicId = input.topicId ?? matchTopic(input.question)
  return topicId === null ? { kind: 'fallback', degraded } : { kind: 'topic', topicId, degraded }
}

/** Trường `null` của máy chủ thành trường vắng. */
function uiActionOf(dto: NonNullable<AssistantReplyDto['uiActions']>[number]): UiAction {
  return Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== null && value !== undefined)) as UiAction
}

function replyOf(dto: AssistantReplyDto): AssistantReply {
  return {
    kind: 'text',
    conversationId: dto.conversationId,
    text: dto.reply,
    uiActions: (dto.uiActions ?? []).map(uiActionOf),
    links: (dto.links ?? []).map(({ label, to }) => ({ label, to })),
    handoff: { offered: dto.handoff?.offered === true, ticketCode: dto.handoff?.ticketCode ?? null },
  }
}

async function post(question: string, context: AssistantAskContext, conversationId: string | null): Promise<AssistantReply> {
  const continued = conversationId === null ? {} : { conversationId }
  if (context.surface === 'public') {
    if (context.guestKey === null) throw new Error('Trang công khai gọi trợ lý mà thiếu mã khách')
    const body: AssistantPublicMessageRequestDto = { ...continued, message: question, locale: context.locale, guestKey: context.guestKey }
    return replyOf(await api().post<AssistantReplyDto>('/api/assistant/public/messages', { body, timeoutMs: ASSISTANT_TIMEOUT_MS }))
  }
  const body: AssistantMessageRequestDto = { ...continued, message: question, locale: context.locale, ...(context.page ? { page: context.page } : {}) }
  return replyOf(await api().post<AssistantReplyDto>('/api/assistant/messages', { body, timeoutMs: ASSISTANT_TIMEOUT_MS }))
}

/** Máy chủ không còn nhận hội thoại cũ (tài khoản khác, hội thoại đã xoá): mở hội thoại mới một lần. */
async function askServer(question: string, context: AssistantAskContext): Promise<AssistantReply> {
  try {
    return await post(question, context, context.conversationId)
  } catch (error) {
    const unknownConversation = isApiError(error) && (error.code === 'RESOURCE_NOT_FOUND' || error.code === 'NOT_FOUND')
    if (context.conversationId === null || !unknownConversation) throw error
    return post(question, context, null)
  }
}

// POST /api/assistant/public/messages (trang công khai) · POST /api/assistant/messages (trong ứng dụng)
export async function askAssistant(input: AssistantQuestion, context: AssistantAskContext): Promise<AssistantReply> {
  if (!ON_BACKEND || input.topicId !== undefined) {
    await wait(ASSISTANT_DELAY_MS)
    return prepared(input, false)
  }
  try {
    return await askServer(input.question, context)
  } catch (error) {
    if (isApiError(error) && (error.code.startsWith('ASSISTANT_') || isTransientApiError(error))) return prepared(input, true)
    throw error
  }
}
