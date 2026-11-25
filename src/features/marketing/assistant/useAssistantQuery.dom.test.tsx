import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { askAssistant, type AssistantAskContext, type AssistantReply } from './assistant-api'
import { setThinkingPace } from './assistant-pace'
import { assistantSession } from './assistant-session'
import { useAskAssistantMutation } from './useAssistantQuery'

/**
 * Nhịp "đang trả lời" (`assistant-pace.ts`) với nhịp thật — `src/test/setup-dom.ts` đặt nhịp 0 cho mọi test DOM khác. Lớp mạng giả trả
 * câu sau một khoảng do test chọn; đồng hồ giả (cả `setTimeout` lẫn `Date`) nên đo được đúng lúc câu trả lời vào cuộc trò chuyện.
 * `pending` của phiên là thứ khung chat dùng để vẽ "Lumo đang trả lời…".
 */
vi.mock('./assistant-api', async (original) => ({ ...(await original<typeof import('./assistant-api')>()), askAssistant: vi.fn() }))

const ask = vi.mocked(askAssistant)
const CONTEXT: AssistantAskContext = { surface: 'public', locale: 'vi', conversationId: null, guestKey: null }

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  )
}

/** Lớp mạng giả trả `reply` (hay lỗi) sau `afterMs`. */
function respond(afterMs: number, reply: AssistantReply | Error) {
  ask.mockImplementation(
    () => new Promise((resolve, reject) => setTimeout(() => (reply instanceof Error ? reject(reply) : resolve(reply)), afterMs)),
  )
}

function send(question: string, topicId?: 'plans') {
  const { result } = renderHook(() => useAskAssistantMutation({ selfSignUp: false, mockRoutes: true }), { wrapper })
  act(() => {
    assistantSession.append({ kind: 'user', text: question })
    assistantSession.setPending(true)
    result.current.mutate({ question, topicId, generation: assistantSession.generation(), context: CONTEXT })
  })
}

const answered = () => assistantSession.get().entries.filter((entry) => entry.kind !== 'user')

/** Tua tới đúng `ms` kể từ lúc gửi (đồng hồ giả bắt đầu ở 0 mỗi test). */
const advanceTo = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms - Date.now()))

const text = (body: string): AssistantReply => ({
  kind: 'text', conversationId: 'c-1', text: body, uiActions: [], links: [], handoff: { offered: false, ticketCode: null },
})

beforeEach(() => {
  vi.useFakeTimers({ now: 0 })
  setThinkingPace(null)
})

afterEach(() => {
  vi.useRealTimers()
  setThinkingPace(() => 0)
  assistantSession.reset()
  ask.mockReset()
})

test('a reply that arrives early waits for the target: "answering" stays on, the answer shows exactly at the target', async () => {
  // Đích: 2000 + 10 × 40 + 6 × 100 = 3000 ms; câu về lúc 1500 ms
  respond(1_500, text('b'.repeat(100)))
  send('a'.repeat(40))

  await advanceTo(1_500)
  expect(ask).toHaveBeenCalledTimes(1)
  expect(answered()).toHaveLength(0)
  expect(assistantSession.get().pending).toBe(true)

  await advanceTo(2_999)
  expect(answered()).toHaveLength(0)
  expect(assistantSession.get().pending).toBe(true)

  await advanceTo(3_000)
  expect(answered()).toMatchObject([{ kind: 'ai', text: 'b'.repeat(100) }])
  expect(assistantSession.get().pending).toBe(false)
})

test('a prepared answer is paced by the translated sentence the panel shows', async () => {
  // "Giá các gói?" (12 ký tự) → câu của chủ đề plans (90 ký tự): 2000 + 120 + 540 = 2660 ms
  respond(0, { kind: 'topic', topicId: 'plans', degraded: false, escalatable: false })
  send('Giá các gói?', 'plans')

  await advanceTo(2_659)
  expect(answered()).toHaveLength(0)
  expect(assistantSession.get().pending).toBe(true)

  await advanceTo(2_660)
  expect(answered()).toMatchObject([{ kind: 'answer', topicId: 'plans' }])
  expect(assistantSession.get().pending).toBe(false)
})

test('a reply slower than the target shows as soon as it arrives, with no extra wait', async () => {
  respond(7_000, text('b'.repeat(100)))
  send('a'.repeat(40))

  await advanceTo(6_999)
  expect(answered()).toHaveLength(0)
  expect(assistantSession.get().pending).toBe(true)

  await advanceTo(7_000)
  expect(answered()).toMatchObject([{ kind: 'ai' }])
  expect(assistantSession.get().pending).toBe(false)
})

test('an error is reported at once, not held to the target', async () => {
  respond(500, new Error('boom'))
  send('a'.repeat(40))

  await advanceTo(500)
  expect(answered()).toMatchObject([{ kind: 'error' }])
  expect(assistantSession.get().pending).toBe(false)
})

test('a late answer from before "Start over" is dropped', async () => {
  respond(1_000, text('cũ'))
  send('a'.repeat(40))
  await advanceTo(1_000)
  act(() => assistantSession.restart())

  await advanceTo(6_000)
  expect(assistantSession.get().entries).toHaveLength(0)
  expect(assistantSession.get().pending).toBe(false)
})
