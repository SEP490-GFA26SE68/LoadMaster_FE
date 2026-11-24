import { api, createApiClient, isApiError, isTransientApiError, type ApiClient } from '@/lib/api-client'
import { backendConfig, usesBackend } from '@/lib/backend-config'
import type { Locale } from '@/lib/i18n'
import type {
  AssistantMessageRequestDto,
  AssistantPublicMessageRequestDto,
  AssistantReplyDto,
  AssistantRouteEventDto,
} from './assistant-dto'
import type { TopicId } from './assistant-kb'
import { matchTopic } from './assistant-match'
import { routeQuestion, type SmallTalkKind } from './assistant-route'
import type { ViewerContext } from './viewer-bridge'

/**
 * Lớp mạng của trợ lý "Hỏi Lumo" — nơi duy nhất biết câu trả lời đến từ đâu.
 *
 * | Hàm            | Endpoint                                                                    |
 * |----------------|-----------------------------------------------------------------------------|
 * | `askAssistant` | `POST /api/assistant/public/messages` · `POST /api/assistant/messages`      |
 * | `recordRoute`  | `POST /api/assistant/public/route-events`                                   |
 *
 * Câu xã giao (chào, cảm ơn, tạm biệt, "ok" — `routeQuestion` của `assistant-route.ts`) luôn trả câu ngắn của từ điển, ở mọi bề mặt, kể
 * cả khi đang nói tiếp với mô hình. Nhóm `assistant` chưa nối máy chủ (kho mẫu): câu còn lại khớp với bộ câu trả lời soạn sẵn ở trình
 * duyệt (`assistant-match.ts`). Lớp này trả câu ngay; nhịp "đang trả lời" (2–6 giây từ lúc gửi) nằm ở `useAskAssistantMutation`. Nối máy chủ, trang
 * công khai: câu gợi ý (kèm `topicId`) và câu gõ mà bộ định tuyến chọn mức soạn sẵn trả câu soạn sẵn (khách bấm "Hỏi Lumo chi tiết" thì
 * cùng câu đó đi tới mô hình, `escalate`), câu còn lại đi tới mô hình; trong ứng dụng câu gõ luôn đi tới mô hình. Máy chủ bận, hết ngân
 * sách (`ASSISTANT_*`) hay không tới được thì trả câu soạn sẵn kèm `degraded` để màn nói rõ; lỗi khác ném ra như mọi lượt gọi.
 */
/** Một lượt trả lời có thể gọi công cụ vài vòng: chờ lâu hơn giới hạn mặc định của client. */
export const ASSISTANT_TIMEOUT_MS = 45_000

const ON_BACKEND = usesBackend('assistant')

/** Câu trả lời đến từ mô hình (nhóm `assistant` nối máy chủ) hay từ bộ câu trả lời soạn sẵn. */
export const ASSISTANT_USES_AI = ON_BACKEND

/** Trang công khai (khách, mã khách) hay trong ứng dụng (người đã đăng nhập). */
export type AssistantSurface = 'public' | 'app'

/** `escalate`: "Hỏi Lumo chi tiết" dưới một câu soạn sẵn — gửi thẳng câu đó cho mô hình, bỏ qua bộ định tuyến. */
export type AssistantQuestion = { readonly question: string; readonly topicId?: TopicId; readonly escalate?: true }

export type AssistantAskContext = {
  readonly surface: AssistantSurface
  readonly locale: Locale
  /** Hội thoại đang nói tiếp với máy chủ; `null` mở hội thoại mới. */
  readonly conversationId: string | null
  /** Mã khách của phiên trình duyệt — bắt buộc ở trang công khai khi nối máy chủ. */
  readonly guestKey: string | null
  readonly page?: { readonly path: string; readonly title: string }
  /** Planner bản máy chủ đang mở (`viewer-bridge.ts`); vắng khi không có. */
  readonly viewer?: ViewerContext
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
  /** `escalatable`: câu soạn sẵn thay cho mô hình đang dùng được — màn mời "Hỏi Lumo chi tiết". */
  | { readonly kind: 'topic'; readonly topicId: TopicId; readonly degraded: boolean; readonly escalatable: boolean }
  | { readonly kind: 'smallTalk'; readonly smallTalk: SmallTalkKind }
  | { readonly kind: 'fallback'; readonly degraded: boolean }
  | {
      readonly kind: 'text'
      readonly conversationId: string
      readonly text: string
      readonly uiActions: readonly UiAction[]
      readonly links: readonly AssistantLink[]
      readonly handoff: AssistantHandoff
    }

function prepared(input: AssistantQuestion, degraded: boolean): AssistantReply {
  const topicId = input.topicId ?? matchTopic(input.question)
  return topicId === null ? { kind: 'fallback', degraded } : { kind: 'topic', topicId, degraded, escalatable: false }
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
  const body: AssistantMessageRequestDto = {
    ...continued,
    message: question,
    locale: context.locale,
    ...(context.page ? { page: context.page } : {}),
    ...(context.viewer ? { viewer: context.viewer } : {}),
  }
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

/** Client không gắn token: lượt đếm của trang công khai không mang gì nhận ra người xem, kể cả khi đang đăng nhập. */
let publicClient: ApiClient | undefined
const publicApi = () => (publicClient ??= createApiClient({ baseUrl: backendConfig.apiUrl, accessToken: () => Promise.resolve(null) }))

/**
 * Đếm một lượt trả lời ở trang công khai không gọi mô hình, hay một lần "Hỏi Lumo chi tiết": gửi rồi quên — không chờ, lỗi thì bỏ, không
 * báo gì. Chỉ mức, chủ đề và ngôn ngữ; không bao giờ có chữ khách gõ hay mã khách. Kho mẫu không gửi gì.
 */
// POST /api/assistant/public/route-events
export function recordRoute(route: AssistantRouteEventDto['route'], topicId: TopicId | null, locale: Locale): void {
  if (!ON_BACKEND) return
  const body: AssistantRouteEventDto = { route, topicId, locale }
  publicApi().post('/api/assistant/public/route-events', { body }).catch(() => undefined)
}

async function askModel(input: AssistantQuestion, context: AssistantAskContext): Promise<AssistantReply> {
  try {
    return await askServer(input.question, context)
  } catch (error) {
    if (isApiError(error) && (error.code.startsWith('ASSISTANT_') || isTransientApiError(error))) return prepared(input, true)
    throw error
  }
}

// POST /api/assistant/public/messages (trang công khai) · POST /api/assistant/messages (trong ứng dụng)
export async function askAssistant(input: AssistantQuestion, context: AssistantAskContext): Promise<AssistantReply> {
  const guest = ON_BACKEND && context.surface === 'public'
  if (input.escalate) {
    if (guest) recordRoute('ESCALATED', input.topicId ?? null, context.locale)
    return askModel(input, context)
  }
  const decision =
    input.topicId === undefined ? routeQuestion(input.question, { inConversation: context.conversationId !== null, locale: context.locale }) : null
  if (decision?.route === 'SMALL_TALK') {
    if (guest) recordRoute('SMALL_TALK', null, context.locale)
    return { kind: 'smallTalk', smallTalk: decision.smallTalk }
  }
  const topicId = input.topicId ?? (decision?.route === 'PREPARED' ? decision.topicId : undefined)
  if (guest && topicId !== undefined) {
    recordRoute('PREPARED', topicId, context.locale)
    return { kind: 'topic', topicId, degraded: false, escalatable: true }
  }
  if (!ON_BACKEND || input.topicId !== undefined) {
    return prepared(input, false)
  }
  return askModel(input, context)
}
