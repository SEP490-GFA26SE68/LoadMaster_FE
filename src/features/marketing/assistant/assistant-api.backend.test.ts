import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import { askAssistant, type AssistantAskContext } from './assistant-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

/**
 * Trợ lý khi nhóm `assistant` nối máy chủ: câu gõ đi tới mô hình (`POST /api/assistant/public/messages` ở trang công khai, `POST
 * /api/assistant/messages` trong ứng dụng); câu gợi ý (có chủ đề) vẫn là câu soạn sẵn. Máy chủ bận, hết ngân sách hay mất mạng thì khách
 * vẫn nhận câu soạn sẵn kèm cờ `degraded`; lỗi khác báo lỗi như mọi màn.
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

  const answer = await askAssistant({ question: 'Gói Pro giá bao nhiêu?' }, PUBLIC)

  expect(answer).toStrictEqual({
    kind: 'text', conversationId: 'c-1', text: 'Gói Pro giá 3.500.000 đ mỗi tháng.', uiActions: [],
    links: [{ label: 'Bảng giá', to: '/bang-gia' }], handoff: { offered: false, ticketCode: null },
  })
  expect(calls.map((call) => call.body)).toStrictEqual([{ message: 'Gói Pro giá bao nhiêu?', locale: 'vi', guestKey: GUEST_KEY }])
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
  await expect(askAssistant({ question: 'Giá các gói?', topicId: 'plans' }, PUBLIC)).resolves.toStrictEqual({ kind: 'topic', topicId: 'plans', degraded: false })
  expect(calls).toHaveLength(0)
})

test('busy, out of budget or unreachable: the prepared answer, marked degraded; other failures are errors', async () => {
  for (const status of [429, 503]) {
    const code = status === 429 ? 'ASSISTANT_RATE_LIMITED' : 'ASSISTANT_BUDGET_EXCEEDED'
    stubBackend({ 'POST /api/assistant/public/messages': { status, body: { success: false, code, message: 'thô' } } })
    await expect(askAssistant({ question: 'Giá các gói thế nào?' }, PUBLIC)).resolves.toStrictEqual({ kind: 'topic', topicId: 'plans', degraded: true })
  }
  stubBackend({ 'POST /api/assistant/public/messages': { status: 502, body: null } })
  await expect(askAssistant({ question: 'Viết thơ giúp tôi' }, PUBLIC)).resolves.toStrictEqual({ kind: 'fallback', degraded: true })

  stubBackend({ 'POST /api/assistant/public/messages': { status: 400, body: { success: false, code: 'INVALID_INPUT', message: 'thô' } } })
  await expect(askAssistant({ question: 'Giá các gói thế nào?' }, PUBLIC)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
})

test('a reply without links, actions or handoff reads as empty lists and no offer', async () => {
  stubBackend({ 'POST /api/assistant/public/messages': { body: envelope({ conversationId: 'c-2', reply: 'Chào bạn.', uiActions: null, links: null, handoff: null }) } })
  await expect(askAssistant({ question: 'Chào' }, PUBLIC)).resolves.toStrictEqual({
    kind: 'text', conversationId: 'c-2', text: 'Chào bạn.', uiActions: [], links: [], handoff: { offered: false, ticketCode: null },
  })
})
