import { useSyncExternalStore } from 'react'
import type { AssistantHandoff, AssistantLink, AssistantSurface, UiAction } from './assistant-api'
import type { TopicId } from './assistant-kb'
import type { SmallTalkKind } from './assistant-route'

/**
 * Cuộc trò chuyện với trợ lý, chỉ trong bộ nhớ của trang (không `localStorage`): đóng rồi mở lại, hay chuyển giữa các trang công khai,
 * vẫn giữ; tải lại trang là mất. Nút mở (bundle đầu) và khung chat (chunk lười) cùng đọc một chỗ này. Khi nối máy chủ, mã hội thoại của
 * từng bề mặt cũng chỉ trong bộ nhớ; mã khách (`guestKey`) nằm ở `sessionStorage` của tab — tải lại trang vẫn là cùng một khách.
 */
export type AssistantEntry =
  | { readonly id: number; readonly kind: 'user'; readonly text: string }
  /**
   * `degraded`: câu soạn sẵn thay cho câu của mô hình (máy chủ bận, hết ngân sách, không tới được). `question`: câu khách đã hỏi, khi
   * hỏi lại được mô hình bằng "Hỏi Lumo chi tiết" (nối máy chủ, trang công khai).
   */
  | { readonly id: number; readonly kind: 'answer'; readonly topicId: TopicId; readonly degraded?: true; readonly question?: string }
  /** Câu xã giao của từ điển (chào, cảm ơn, tạm biệt, "ok"). */
  | { readonly id: number; readonly kind: 'smallTalk'; readonly smallTalk: SmallTalkKind }
  | { readonly id: number; readonly kind: 'fallback'; readonly degraded?: true }
  | { readonly id: number; readonly kind: 'advisor'; readonly runs: number }
  /** `cause`: lỗi của lượt gọi không có câu soạn sẵn thay thế (bản tin) — màn nói đúng lý do; vắng là câu "chưa trả lời được" chung. */
  | { readonly id: number; readonly kind: 'error'; readonly cause?: unknown }
  /** Bản tin "Tóm tắt hôm nay": gạch đầu dòng và liên kết do máy chủ dựng, giờ máy chủ đếm số. */
  | {
      readonly id: number
      readonly kind: 'briefing'
      readonly generatedAt: string
      readonly bullets: readonly string[]
      readonly links: readonly AssistantLink[]
    }
  | {
      readonly id: number
      readonly kind: 'ai'
      readonly text: string
      readonly links: readonly AssistantLink[]
      readonly handoff: AssistantHandoff
      readonly uiActions: readonly UiAction[]
    }

/** `id` của khung chat — `aria-controls` của nút mở. */
export const ASSISTANT_PANEL_ID = 'tro-ly-lumo'

/** Khoá `sessionStorage` của mã khách. */
export const GUEST_KEY_STORAGE = 'loadmaster.tro-ly-lumo'
const GUEST_KEY = /^[A-Za-z0-9_-]{16,64}$/
const GUEST_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'

type NewEntry = AssistantEntry extends infer Entry ? (Entry extends AssistantEntry ? Omit<Entry, 'id'> : never) : never

export type AssistantSession = {
  readonly open: boolean
  readonly entries: readonly AssistantEntry[]
  readonly pending: boolean
  /** Khung chat phóng to (từ 768 px). Giữ qua "Bắt đầu lại" và khi chuyển giữa hai trang công khai. */
  readonly expanded: boolean
}

const INITIAL: AssistantSession = { open: false, entries: [], pending: false, expanded: false }

let session = INITIAL
let nextId = 1
/** Tăng mỗi lần "Bắt đầu lại": câu trả lời về muộn của cuộc trò chuyện cũ bị bỏ. */
let generation = 0
let conversations: Partial<Record<AssistantSurface, string>> = {}
let guest: string | null = null
/** Ai đang trò chuyện (`<bề mặt>:<mã người dùng>`): đổi người hay đổi bề mặt thì cuộc trò chuyện cũ không theo sang. */
let owner: string | null = null
const listeners = new Set<() => void>()

function update(patch: Partial<AssistantSession>) {
  session = { ...session, ...patch }
  for (const listener of listeners) listener()
}

function newGuestKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => GUEST_ALPHABET[byte % GUEST_ALPHABET.length]).join('')
}

/** Mã khách của tab: đọc `sessionStorage`, không có (hay trình duyệt chặn) thì sinh mới; trong một lần mở trang luôn là một mã. */
function guestKey(): string {
  if (guest !== null) return guest
  try {
    const stored = sessionStorage.getItem(GUEST_KEY_STORAGE)
    if (stored !== null && GUEST_KEY.test(stored)) return (guest = stored)
  } catch {
    // Trình duyệt chặn bộ nhớ của trang: mã chỉ sống tới khi tải lại
  }
  guest = newGuestKey()
  try {
    sessionStorage.setItem(GUEST_KEY_STORAGE, guest)
  } catch {
    // như trên
  }
  return guest
}

export const assistantSession = {
  get: (): AssistantSession => session,
  generation: (): number => generation,
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  setOpen: (open: boolean) => update({ open }),
  setPending: (pending: boolean) => update({ pending }),
  setExpanded: (expanded: boolean) => update({ expanded }),
  append(...entries: readonly NewEntry[]) {
    update({ entries: [...session.entries, ...entries.map((entry) => ({ ...entry, id: nextId++ }) as AssistantEntry)] })
  },
  /** Hội thoại đang nói tiếp với máy chủ ở bề mặt đó; `null` là chưa có. */
  conversationId: (surface: AssistantSurface): string | null => conversations[surface] ?? null,
  setConversationId(surface: AssistantSurface, id: string) {
    conversations = { ...conversations, [surface]: id }
  },
  guestKey,
  /** Gắn cuộc trò chuyện với người đang xem; người khác (đăng xuất rồi đăng nhập, từ trang công khai vào ứng dụng) thì xoá và đóng khung. */
  bind(next: string) {
    if (owner !== null && owner !== next) {
      generation += 1
      conversations = {}
      update({ entries: [], pending: false, open: false })
    }
    owner = next
  },
  /** "Bắt đầu lại": xoá cuộc trò chuyện (và hội thoại ở máy chủ), khung vẫn mở. */
  restart() {
    generation += 1
    conversations = {}
    update({ entries: [], pending: false })
  },
  /** Về trạng thái đầu (test). */
  reset() {
    session = INITIAL
    nextId = 1
    generation += 1
    conversations = {}
    guest = null
    owner = null
    for (const listener of listeners) listener()
  },
}

export function useAssistantSession(): AssistantSession {
  return useSyncExternalStore(assistantSession.subscribe, assistantSession.get, assistantSession.get)
}
