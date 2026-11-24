import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import { askAssistant, type AssistantAskContext } from './assistant-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

/**
 * Trợ lý khi nhóm `assistant` nối máy chủ: câu gõ cần mô hình đi tới mô hình (`POST /api/assistant/public/messages` ở trang công
 * khai, `POST /api/assistant/messages` trong ứng dụng); câu cơ bản ở trang công khai và câu gợi ý (có chủ đề) là câu soạn sẵn, câu xã
 * giao là câu của từ điển — mỗi lượt đó gửi một lượt đếm không có chữ khách gõ. Máy chủ bận, hết ngân sách hay mất mạng thì khách vẫn
 * nhận câu soạn sẵn kèm cờ `degraded`; lỗi khác báo lỗi như mọi màn.
 */
const GUEST_KEY = 'k'.repeat(32)
const PUBLIC: AssistantAskContext = { surface: 'public', locale: 'vi', conversationId: null, guestKey: GUEST_KEY }
const APP: AssistantAskContext = { surface: 'app', locale: 'en', conversationId: null, guestKey: null, page: { path: '/chuyen', title: 'Chuyến hàng' } }

const reply = (conversationId: string, extra: Record<string, unknown> = {}) =>
  envelope({ conversationId, reply: 'Gói Pro giá 3.500.000 đ mỗi tháng.', uiActions: [], links: [], handoff: { offered: false, ticketCode: null }, usage: null, ...extra })

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a typed question on a public page goes to the public endpoint with the guest key, and the reply is the model text', async () => {
  const { calls } = stubBackend({ 'POST /api/assistant/public/messages': { body: reply('c-1', { links: [{ label: 'Bảng giá', to: '/bang-gia' }] }) } })

  const answer = await askAssistant({ question: 'Gói Pro hơn gói Basic ở điểm nào?' }, PUBLIC)

  expect(answer).toStrictEqual({
    kind: 'text', conversationId: 'c-1', text: 'Gói Pro giá 3.500.000 đ mỗi tháng.', uiActions: [],
    links: [{ label: 'Bảng giá', to: '/bang-gia' }], handoff: { offered: false, ticketCode: null },
  })
  expect(calls.map((call) => call.body)).toStrictEqual([{ message: 'Gói Pro hơn gói Basic ở điểm nào?', locale: 'vi', guestKey: GUEST_KEY }])
})

test('in the app the question goes to the signed-in endpoint with the open screen, and a known conversation is continued', async () => {
  const { calls } = stubBackend({ 'POST /api/assistant/messages': { body: reply('c-9', { handoff: { offered: true, ticketCode: null } }) } })

  const answer = await askAssistant({ question: 'How do I re-optimize?' }, { ...APP, conversationId: 'c-9' })

  expect(answer).toMatchObject({ kind: 'text', conversationId: 'c-9', handoff: { offered: true, ticketCode: null } })
  expect(calls.map((call) => call.body)).toStrictEqual([
    { conversationId: 'c-9', message: 'How do I re-optimize?', locale: 'en', page: { path: '/chuyen', title: 'Chuyến hàng' } },
  ])
})

test('from the server Planner the question carries the open plan, and the reply keeps its interface commands without empty fields', async () => {
  const uiActions = [
    { type: 'selectPackage', packageCode: 'PK-7', preset: null, step: null, mode: null, tab: null },
    { type: 'setCameraPreset', packageCode: null, preset: 'tren', step: null, mode: null, tab: null },
  ]
  const { calls } = stubBackend({ 'POST /api/assistant/messages': { body: reply('c-3', { uiActions }) } })
  const viewer = { tripCode: 'TRIP-0007', loadPlanId: 41, selectedPackageCode: null }

  const answer = await askAssistant({ question: 'Kiện PK-7 nằm đâu?' }, { ...APP, viewer })

  expect(answer.kind === 'text' ? answer.uiActions : null).toStrictEqual([{ type: 'selectPackage', packageCode: 'PK-7' }, { type: 'setCameraPreset', preset: 'tren' }])
  expect(calls.map((call) => call.body)).toStrictEqual([
    { message: 'Kiện PK-7 nằm đâu?', locale: 'en', page: { path: '/chuyen', title: 'Chuyến hàng' }, viewer },
  ])
})

test('a conversation the server no longer knows (another account, expired) is started over once, not reported as an error', async () => {
  const { calls } = stubBackend({
    'POST /api/assistant/messages': (call: FakeCall) =>
      call.body !== null && typeof call.body === 'object' && 'conversationId' in call.body
        ? { status: 404, body: { success: false, code: 'RESOURCE_NOT_FOUND', message: 'Not found' } }
        : { body: reply('c-new') },
  })

  await expect(askAssistant({ question: 'Chuyến nào đang chạy?' }, { ...APP, conversationId: 'c-old' })).resolves.toMatchObject({ conversationId: 'c-new' })
  expect(calls).toHaveLength(2)
})

test('a suggested question (with its topic) is answered from the prepared answers without calling the server', async () => {
  const { calls } = stubBackend({})
  await expect(askAssistant({ question: 'Giá các gói?', topicId: 'plans' }, PUBLIC)).resolves.toStrictEqual({
    kind: 'topic', topicId: 'plans', degraded: false, escalatable: true,
  })
  expect(calls.map(({ method, path, body }) => ({ method, path, body }))).toStrictEqual([
    { method: 'POST', path: '/api/assistant/public/route-events', body: { route: 'PREPARED', topicId: 'plans', locale: 'vi' } },
  ])
})

test('a basic typed question on a public page is answered from the prepared answers; a deep one goes to the model', async () => {
  const { calls } = stubBackend({ 'POST /api/assistant/public/messages': { body: reply('c-5') } })

  await expect(askAssistant({ question: 'Gói Pro giá bao nhiêu?' }, PUBLIC)).resolves.toStrictEqual({
    kind: 'topic', topicId: 'plans', degraded: false, escalatable: true,
  })
  expect(calls.map((call) => call.path)).toStrictEqual(['/api/assistant/public/route-events'])

  await expect(askAssistant({ question: 'Công ty mình có 12 xe thì nên chọn gói nào?' }, PUBLIC)).resolves.toMatchObject({ kind: 'text' })
  expect(calls.map((call) => call.path)).toStrictEqual(['/api/assistant/public/route-events', '/api/assistant/public/messages'])
})

test('inside a model conversation a basic question keeps going to the model; small talk never does', async () => {
  const { calls } = stubBackend({ 'POST /api/assistant/public/messages': { body: reply('c-7') } })
  const continued = { ...PUBLIC, conversationId: 'c-7' }

  await expect(askAssistant({ question: 'Gói Pro giá bao nhiêu?' }, continued)).resolves.toMatchObject({ kind: 'text', conversationId: 'c-7' })
  await expect(askAssistant({ question: 'cảm ơn bạn nhé' }, continued)).resolves.toStrictEqual({ kind: 'smallTalk', smallTalk: 'THANKS' })
  expect(calls.map(({ path, body }) => ({ path, body }))).toStrictEqual([
    { path: '/api/assistant/public/messages', body: { conversationId: 'c-7', message: 'Gói Pro giá bao nhiêu?', locale: 'vi', guestKey: GUEST_KEY } },
    { path: '/api/assistant/public/route-events', body: { route: 'SMALL_TALK', topicId: null, locale: 'vi' } },
  ])
})

test('"ask Lumo for details" sends the very same question to the model and counts one escalation', async () => {
  const { calls } = stubBackend({ 'POST /api/assistant/public/messages': { body: reply('c-8') } })

  await expect(askAssistant({ question: 'Gói Pro giá bao nhiêu?', topicId: 'plans', escalate: true }, PUBLIC)).resolves.toMatchObject({ kind: 'text' })
  expect(calls.map(({ path, body }) => ({ path, body }))).toStrictEqual([
    { path: '/api/assistant/public/route-events', body: { route: 'ESCALATED', topicId: 'plans', locale: 'vi' } },
    { path: '/api/assistant/public/messages', body: { message: 'Gói Pro giá bao nhiêu?', locale: 'vi', guestKey: GUEST_KEY } },
  ])
})

test('a route event carries no token, no guest key and nothing the visitor typed, and its failure is ignored', async () => {
  const sent: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    sent.push({ url, init })
    return Promise.reject(new TypeError('Failed to fetch'))
  })

  await expect(askAssistant({ question: 'Gói Pro giá bao nhiêu? Mình tên Lan, số 0909 123 456' , topicId: 'plans' }, PUBLIC)).resolves.toMatchObject({ kind: 'topic' })

  expect(sent).toHaveLength(1)
  const headers = new Headers(sent[0]?.init.headers)
  expect(headers.has('Authorization')).toBe(false)
  expect(JSON.parse(String(sent[0]?.init.body))).toStrictEqual({ route: 'PREPARED', topicId: 'plans', locale: 'vi' })
  expect(String(sent[0]?.init.body)).not.toContain(GUEST_KEY)
})

test('in the app only small talk skips the model', async () => {
  const { calls } = stubBackend({ 'POST /api/assistant/messages': { body: reply('c-4') } })

  await expect(askAssistant({ question: 'How much is the Pro plan?' }, APP)).resolves.toMatchObject({ kind: 'text' })
  await expect(askAssistant({ question: 'thanks!' }, APP)).resolves.toStrictEqual({ kind: 'smallTalk', smallTalk: 'THANKS' })
  expect(calls.map((call) => call.path)).toStrictEqual(['/api/assistant/messages'])
})

test('busy, out of budget or unreachable: the prepared answer, marked degraded; other failures are errors', async () => {
  for (const status of [429, 503]) {
    const code = status === 429 ? 'ASSISTANT_RATE_LIMITED' : 'ASSISTANT_BUDGET_EXCEEDED'
    stubBackend({ 'POST /api/assistant/public/messages': { status, body: { success: false, code, message: 'thô' } } })
    await expect(askAssistant({ question: 'Giá các gói đã gồm VAT chưa?' }, PUBLIC)).resolves.toStrictEqual({
      kind: 'topic', topicId: 'plans', degraded: true, escalatable: false,
    })
  }
  stubBackend({ 'POST /api/assistant/public/messages': { status: 502, body: null } })
  await expect(askAssistant({ question: 'Viết thơ giúp tôi' }, PUBLIC)).resolves.toStrictEqual({ kind: 'fallback', degraded: true })

  stubBackend({ 'POST /api/assistant/public/messages': { status: 400, body: { success: false, code: 'INVALID_INPUT', message: 'thô' } } })
  await expect(askAssistant({ question: 'Giá các gói đã gồm VAT chưa?' }, PUBLIC)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

test('a reply without links, actions or handoff reads as empty lists and no offer', async () => {
  stubBackend({ 'POST /api/assistant/public/messages': { body: envelope({ conversationId: 'c-2', reply: 'Chào bạn.', uiActions: null, links: null, handoff: null }) } })
  await expect(askAssistant({ question: 'Lumo trả lời được những gì?' }, PUBLIC)).resolves.toStrictEqual({
    kind: 'text', conversationId: 'c-2', text: 'Chào bạn.', uiActions: [], links: [], handoff: { offered: false, ticketCode: null },
  })
})
