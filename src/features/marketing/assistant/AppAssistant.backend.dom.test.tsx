import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import type { Role } from '@/types/user'
import { AppAssistant } from './AppAssistant'
import { assistantSession } from './assistant-session'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

type MockUser = { id: string; fullName: string; email: string; role: Role; status: 'active' | 'flagged'; subscriptionExpired?: boolean }

const auth = vi.hoisted(() => ({ user: null as MockUser | null, signOut: () => {}, refreshUser: () => {} }))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => auth,
  useAuthSafe: () => auth,
}))

/**
 * Nút "Trợ lý AI" của khung ứng dụng khi nhóm `assistant` nối máy chủ: có với người dùng thường và vai trò nền tảng; không có với người bị
 * gắn cờ hay công ty không còn gói hiệu lực (quản trị công ty vẫn mở `/goi-cuoc` nhưng máy chủ từ chối trợ lý). Đổi người đăng nhập thì
 * cuộc trò chuyện của người trước không theo sang.
 */
const ANSWER = { timeout: 4000 }

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

const person = (id: string, role: Role, extra: Partial<MockUser> = {}): MockUser =>
  ({ id, fullName: 'Nguyễn Văn An', email: `${id.toLowerCase()}@longbinh.vn`, role, status: 'active', ...extra })

function shell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/chuyen']}>
          <AppAssistant />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  auth.user = null
})

afterEach(() => {
  cleanup()
  assistantSession.reset()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

test.each([
  ['dispatcher', person('US-0002', 'dispatcher')],
  ['a platform role, even when its flag says expired', person('US-NT-03', 'systemSupporter', { subscriptionExpired: true })],
])('%s gets the "AI assistant" button', (_, user) => {
  auth.user = user
  render(shell())
  expect(screen.getByRole('button', { name: 'Trợ lý AI' })).toBeInTheDocument()
})

test.each([
  ['nobody is signed in', null],
  ['the account is flagged', person('US-0002', 'dispatcher', { status: 'flagged' })],
  ['the company has no active plan (company admin on the billing screen)', person('US-0001', 'companyAdmin', { subscriptionExpired: true })],
])('no button when %s', (_, user) => {
  auth.user = user
  render(shell())
  expect(screen.queryByRole('button', { name: 'Trợ lý AI' })).not.toBeInTheDocument()
})

test('signing in as someone else closes the panel and drops the previous conversation', async () => {
  const { calls } = stubBackend({
    'POST /api/assistant/messages': { body: envelope({ conversationId: 'c-1', reply: 'Chuyến TRIP-2026-0914 đang xếp hàng.', uiActions: [], links: [], handoff: { offered: false, ticketCode: null } }) },
  })
  auth.user = person('US-0002', 'dispatcher')
  const { rerender } = render(shell())
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  const panel = within(await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER))
  await user.type(panel.getByRole('textbox', { name: 'Câu hỏi của bạn' }), 'Chuyến nào đang xếp?{Enter}')
  expect(await panel.findByText('Chuyến TRIP-2026-0914 đang xếp hàng.', {}, ANSWER)).toBeInTheDocument()
  expect((calls[0] as FakeCall).body).toMatchObject({ page: { path: '/chuyen' } })
  expect((calls[0] as FakeCall).body).not.toHaveProperty('guestKey')

  auth.user = person('US-0003', 'companyManager')
  rerender(shell())
  expect(screen.getByRole('button', { name: 'Trợ lý AI' })).toHaveAttribute('aria-expanded', 'false')
  expect(assistantSession.get().entries).toStrictEqual([])

  await user.click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  const next = within(await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER))
  expect(next.queryByText('Chuyến TRIP-2026-0914 đang xếp hàng.')).not.toBeInTheDocument()
  await user.type(next.getByRole('textbox', { name: 'Câu hỏi của bạn' }), 'Chào{Enter}')
  await next.findByText('Chuyến TRIP-2026-0914 đang xếp hàng.', {}, ANSWER)
  expect((calls[1] as FakeCall).body).not.toHaveProperty('conversationId')
})

/**
 * Màn chào trong ứng dụng không gợi ý câu của trang công khai (giá gói, dùng thử): câu theo vai trò, gửi cho mô hình như câu gõ — không
 * trả câu soạn sẵn của một chủ đề.
 */
test('the app welcome suggests questions for the role and sends them to the model', async () => {
  const { calls } = stubBackend({
    'POST /api/assistant/messages': { body: envelope({ conversationId: 'c-1', reply: 'Có 1 chuyến đang vận chuyển: TRIP-009.', uiActions: [], links: [], handoff: { offered: false, ticketCode: null } }) },
  })
  auth.user = person('US-0002', 'dispatcher')
  render(shell())
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  const panel = within(await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER))
  const starters = panel.getByRole('group', { name: 'Câu hỏi gợi ý' })
  expect(within(starters).getAllByRole('button').map((b) => b.textContent)).toStrictEqual([
    'Màn này dùng để làm gì?',
    'Có chuyến nào đang vận chuyển?',
    'Công ty còn bao nhiêu credit?',
    'Yêu cầu hỗ trợ của tôi tới đâu rồi?',
  ])
  expect(panel.queryByRole('button', { name: 'Giá các gói?' })).not.toBeInTheDocument()

  await user.click(within(starters).getByRole('button', { name: 'Có chuyến nào đang vận chuyển?' }))
  expect(await panel.findByText('Có 1 chuyến đang vận chuyển: TRIP-009.', {}, ANSWER)).toBeInTheDocument()
  expect((calls[0] as FakeCall).body).toMatchObject({ message: 'Có chuyến nào đang vận chuyển?', page: { path: '/chuyen' } })
})
