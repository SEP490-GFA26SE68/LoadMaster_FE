import { useSyncExternalStore } from 'react'
import type { TopicId } from './assistant-kb'

/**
 * Cuộc trò chuyện với trợ lý, chỉ trong bộ nhớ của trang (không `localStorage`, không gửi đi đâu): đóng rồi mở lại, hay chuyển giữa trang
 * giới thiệu và Bảng giá, vẫn giữ; tải lại trang là mất. Nút mở (bundle đầu) và khung chat (chunk lười) cùng đọc một chỗ này.
 */
export type AssistantEntry =
  | { readonly id: number; readonly kind: 'user'; readonly text: string }
  | { readonly id: number; readonly kind: 'answer'; readonly topicId: TopicId }
  | { readonly id: number; readonly kind: 'fallback' }
  | { readonly id: number; readonly kind: 'advisor'; readonly runs: number }
  | { readonly id: number; readonly kind: 'error' }

/** `id` của khung chat — `aria-controls` của nút mở. */
export const ASSISTANT_PANEL_ID = 'tro-ly-lumo'

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
const listeners = new Set<() => void>()

function update(patch: Partial<AssistantSession>) {
  session = { ...session, ...patch }
  for (const listener of listeners) listener()
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
  /** "Bắt đầu lại": xoá cuộc trò chuyện, khung vẫn mở. */
  restart() {
    generation += 1
    update({ entries: [], pending: false })
  },
  /** Về trạng thái đầu (test). */
  reset() {
    session = INITIAL
    nextId = 1
    generation += 1
    for (const listener of listeners) listener()
  },
}

export function useAssistantSession(): AssistantSession {
  return useSyncExternalStore(assistantSession.subscribe, assistantSession.get, assistantSession.get)
}
