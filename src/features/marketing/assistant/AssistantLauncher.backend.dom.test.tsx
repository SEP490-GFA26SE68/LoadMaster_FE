import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import { assistantSession, GUEST_KEY_STORAGE } from './assistant-session'
import { AssistantSurfaceContext } from './assistant-surface'
import { AssistantLauncher } from './AssistantLauncher'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

/**
 * Trợ lý khi nhóm `assistant` nối máy chủ: câu cơ bản là câu soạn sẵn kèm nút "Hỏi Lumo chi tiết" (gửi đúng câu đó cho mô hình), câu xã
 * giao là câu của từ điển — cả hai không gọi mô hình, chỉ gửi một lượt đếm không có chữ khách gõ; câu cần mô hình đi tới mô hình, lượt sau nói tiếp cùng hội thoại với cùng mã khách; câu trả lời vẽ
 * bằng phần tử thường, chỉ giữ liên kết trong app mà người xem mở được; máy chủ hết ngân sách thì câu soạn sẵn kèm một dòng nói rõ; trợ lý
 * mời chuyển cho đội hỗ trợ thì có hai nút trả lời. jsdom không có `matchMedia` nên khung chat ở dạng máy tính.
 */
const ANSWER = { timeout: 4000 }

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

const reply = (conversationId: string, text: string, extra: Record<string, unknown> = {}) =>
  ({ body: envelope({ conversationId, reply: text, uiActions: [], links: [], handoff: { offered: false, ticketCode: null }, ...extra }) })

const bodyOf = (call: FakeCall | undefined) => call?.body as Record<string, unknown> | undefined

async function openAssistant(surface: 'public' | 'app' = 'public') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrap = (children: ReactNode) => (surface === 'app' ? <AssistantSurfaceContext value="app">{children}</AssistantSurfaceContext> : children)
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/gioi-thieu']}>{wrap(<AssistantLauncher />)}</MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: surface === 'app' ? 'Trợ lý AI' : 'Hỏi Lumo' }))
  const panel = within(await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER))
  const ask = async (question: string) => {
    await user.type(panel.getByRole('textbox', { name: 'Câu hỏi của bạn' }), `${question}{Enter}`)
  }
  return { user, panel, ask }
}

afterEach(() => {
  cleanup()
  assistantSession.reset()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

test('a typed question gets the model answer; the next turn continues the same conversation with the same guest key; "Start over" opens a new one', async () => {
  let turn = 0
  const { calls } = stubBackend({
    'POST /api/assistant/public/messages': () => {
      turn += 1
      return reply('c-1', turn === 1 ? 'Gói **Pro** giá 3.500.000 đ mỗi tháng.\n\n- 10.000 credit\n- Hạng Nâng cao' : 'Một lần chạy dùng 2 credit.', {
        links: [
          { label: 'Bảng giá', to: '/bang-gia' },
          { label: 'Trang lạ', to: 'https://lua.example/bang-gia' },
          { label: 'Không có màn này', to: '/khong-co-man-nay' },
          { label: 'Người dùng', to: '/nguoi-dung' },
        ],
      })
    },
  })
  const { user, panel, ask } = await openAssistant()
  expect(panel.getByText('Lumo là trợ lý AI, trả lời từ tài liệu của LoadMaster và có thể nhầm — việc quan trọng hãy hỏi đội LoadMaster.')).toBeInTheDocument()

  await ask('Gói Pro hơn gói Basic ở điểm nào?')
  expect(await panel.findByText('Gói Pro giá 3.500.000 đ mỗi tháng.', {}, ANSWER)).toBeInTheDocument()
  expect(panel.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual(['10.000 credit', 'Hạng Nâng cao'])
  // Chỉ liên kết trong app mà khách mở được: bảng giá. Trang ngoài, màn không có, màn cần quyền đều bị bỏ
  const links = within(panel.getByRole('group', { name: 'Mở màn liên quan' })).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toStrictEqual(['/bang-gia'])

  await ask('Một lần chạy tốn bao nhiêu?')
  expect(await panel.findByText('Một lần chạy dùng 2 credit.', {}, ANSWER)).toBeInTheDocument()
  const [first, second] = calls.map(bodyOf)
  expect(first).toMatchObject({ message: 'Gói Pro hơn gói Basic ở điểm nào?', locale: 'vi' })
  expect(first).not.toHaveProperty('conversationId')
  expect(first?.guestKey).toMatch(/^[A-Za-z0-9_-]{32}$/)
  expect(second).toMatchObject({ conversationId: 'c-1', guestKey: first?.guestKey })
  expect(sessionStorage.getItem(GUEST_KEY_STORAGE)).toBe(first?.guestKey)

  await user.click(panel.getByRole('button', { name: 'Bắt đầu lại' }))
  await ask('Lumo trả lời được những gì?')
  await panel.findByText('Một lần chạy dùng 2 credit.', {}, ANSWER)
  expect(bodyOf(calls[2])).not.toHaveProperty('conversationId')
  expect(bodyOf(calls[2])?.guestKey).toBe(first?.guestKey)
})

test('a basic question gets the prepared answer without the model; "ask Lumo for details" sends the same question to the model', async () => {
  const { calls } = stubBackend({ 'POST /api/assistant/public/messages': reply('c-3', 'Gói Pro giá 3.500.000 đ, gồm 10.000 credit mỗi tháng.') })
  const { user, panel, ask } = await openAssistant()

  await ask('Gói Pro giá bao nhiêu?')
  const detail = await panel.findByRole('button', { name: 'Chưa đúng ý? Hỏi Lumo chi tiết' }, ANSWER)
  // Cạnh nút đó, lối sang form liên hệ không mở đầu bằng "Chưa đúng ý?" nữa
  expect(panel.getByRole('button', { name: 'Gửi câu hỏi cho đội LoadMaster' })).toBeInTheDocument()
  expect(calls.map((call) => call.path)).toStrictEqual(['/api/assistant/public/route-events'])
  expect(bodyOf(calls[0])).toStrictEqual({ route: 'PREPARED', topicId: 'plans', locale: 'vi' })

  await user.click(detail)
  expect(panel.getByRole('log')).toHaveFocus()
  expect(await panel.findByText('Gói Pro giá 3.500.000 đ, gồm 10.000 credit mỗi tháng.', {}, ANSWER)).toBeInTheDocument()
  expect(calls.map(({ path, body }) => ({ path, body: { ...(body as object), guestKey: undefined } }))).toStrictEqual([
    { path: '/api/assistant/public/route-events', body: { route: 'PREPARED', topicId: 'plans', locale: 'vi', guestKey: undefined } },
    { path: '/api/assistant/public/route-events', body: { route: 'ESCALATED', topicId: 'plans', locale: 'vi', guestKey: undefined } },
    { path: '/api/assistant/public/messages', body: { message: 'Gói Pro giá bao nhiêu?', locale: 'vi', guestKey: undefined } },
  ])
  // Mỗi lượt đếm chỉ có mức, chủ đề, ngôn ngữ — không chữ khách gõ, không mã khách
  for (const call of calls.slice(0, 2)) expect(Object.keys(bodyOf(call) ?? {}).sort()).toStrictEqual(['locale', 'route', 'topicId'])

  // Đã nói chuyện với mô hình: câu cơ bản sau đó cũng đi tới mô hình, cùng hội thoại
  await ask('Gói Basic giá bao nhiêu?')
  await vi.waitFor(() => expect(calls).toHaveLength(4), ANSWER)
  expect(bodyOf(calls[3])).toMatchObject({ conversationId: 'c-3', message: 'Gói Basic giá bao nhiêu?' })
})

test('small talk gets a short reply and suggested questions, never the model', async () => {
  const { calls } = stubBackend({})
  const { panel, ask } = await openAssistant()

  await ask('cảm ơn bạn nhé')
  expect(await panel.findByText('Không có gì! Bạn còn thắc mắc gì cứ hỏi mình nhé.', {}, ANSWER)).toBeInTheDocument()
  expect(within(panel.getByRole('group', { name: 'Hỏi tiếp' })).getAllByRole('button')).toHaveLength(4)
  expect(calls.map(({ path, body }) => ({ path, body }))).toStrictEqual([
    { path: '/api/assistant/public/route-events', body: { route: 'SMALL_TALK', topicId: null, locale: 'vi' } },
  ])
})

test('out of budget: the prepared answer, with one line saying the AI assistant is busy', async () => {
  stubBackend({
    'POST /api/assistant/public/messages': { status: 503, body: { success: false, code: 'ASSISTANT_BUDGET_EXCEEDED', message: 'thô' } },
  })
  const { panel, ask } = await openAssistant()

  await ask('Giá các gói đã gồm VAT chưa?')
  expect(await panel.findByText('Trợ lý AI đang bận nên đây là câu trả lời soạn sẵn.', {}, ANSWER)).toBeInTheDocument()
  expect(panel.queryByText('thô')).not.toBeInTheDocument()
})

test('in the app: the model offers to pass the question on; "Yes" is sent as a reply and the created request is named', async () => {
  let turn = 0
  const { calls } = stubBackend({
    'POST /api/assistant/messages': () => {
      turn += 1
      return turn === 1
        ? reply('c-7', 'Mình chưa xử lý được việc này. Bạn có muốn chuyển cho đội hỗ trợ không?', { handoff: { offered: true, ticketCode: null } })
        : reply('c-7', 'Đã chuyển cho đội hỗ trợ.', { handoff: { offered: false, ticketCode: 'TKT-0042' } })
    },
  })
  const { user, panel, ask } = await openAssistant('app')
  expect(panel.getByText('Lumo là trợ lý AI, trả lời từ tài liệu và dữ liệu bạn được xem, và có thể nhầm — kiểm lại trước khi làm việc quan trọng.')).toBeInTheDocument()

  await ask('Hoàn tiền credit cho tôi')
  const offer = within(await panel.findByRole('group', { name: 'Chuyển câu hỏi cho đội hỗ trợ?' }, ANSWER))
  // Trong ứng dụng không có lối sang form liên hệ của trang giới thiệu
  expect(panel.queryByRole('button', { name: 'Chưa đúng ý? Hỏi đội LoadMaster' })).not.toBeInTheDocument()
  await user.click(offer.getByRole('button', { name: 'Có, chuyển cho đội hỗ trợ' }))

  expect(await panel.findByText('Đã tạo yêu cầu hỗ trợ TKT-0042. Đội hỗ trợ trả lời ở mục “Yêu cầu hỗ trợ” của menu tài khoản.', {}, ANSWER)).toBeInTheDocument()
  expect(panel.queryByRole('group', { name: 'Chuyển câu hỏi cho đội hỗ trợ?' })).not.toBeInTheDocument()
  expect(calls.map(bodyOf)).toMatchObject([
    { message: 'Hoàn tiền credit cho tôi', page: { path: '/gioi-thieu' } },
    { conversationId: 'c-7', message: 'Có, chuyển cho đội hỗ trợ.' },
  ])
  expect(calls.every((call) => call.path === '/api/assistant/messages')).toBe(true)
})
