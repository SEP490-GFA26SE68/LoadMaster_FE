import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall, type FakeRoutes } from '@/test/fake-backend'
import type { Role } from '@/types/user'
import { AppAssistant } from './AppAssistant'
import { assistantSession } from './assistant-session'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

type MockUser = { id: string; fullName: string; email: string; role: Role; status: 'active' }

const auth = vi.hoisted(() => ({ user: null as MockUser | null, signOut: () => {}, refreshUser: () => {} }))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => auth,
  useAuthSafe: () => auth,
}))

/**
 * Nút "Tóm tắt hôm nay" ở màn chào của khung chat trong ứng dụng: chỉ điều phối viên và quản lý công ty, chỉ gọi máy chủ khi bấm. Bản tin
 * hiện như một câu trả lời của Lumo (gạch đầu dòng, giờ máy chủ đếm số, liên kết người xem mở được); lỗi nói đúng lý do.
 */
const ANSWER = { timeout: 4000 }
const BRIEFING = 'GET /api/assistant/briefing'

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

const person = (id: string, role: Role): MockUser => ({ id, fullName: 'Nguyễn Văn An', email: `${id.toLowerCase()}@longbinh.vn`, role, status: 'active' })

const briefingCalls = (calls: readonly FakeCall[]) => calls.filter((call) => `${call.method} ${call.path}` === BRIEFING)

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

async function openPanel(user: MockUser, routes: FakeRoutes = {}) {
  const backend = stubBackend(routes)
  auth.user = user
  render(shell())
  const clicker = userEvent.setup()
  await clicker.click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  const panel = within(await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER))
  return { ...backend, clicker, panel }
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

test('opening the panel does not ask for the briefing; pressing the button asks once and answers as Lumo', async () => {
  const { calls, clicker, panel } = await openPanel(person('US-0002', 'dispatcher'), {
    [BRIEFING]: {
      body: envelope({
        generatedAt: '2026-11-21T01:15:00Z',
        bullets: ['TRIP-2026-1102 có 1 sự cố đã chuyển quản lý và 2 điểm có nguy cơ trễ.', 'Còn 600 credit, dưới ngưỡng 750.'],
        links: [
          { label: 'Giám sát', to: '/giam-sat' },
          { label: 'Chuyến TRIP-2026-1102', to: '/chuyen/TRIP-2026-1102' },
          { label: 'Người dùng', to: '/nguoi-dung' },
        ],
      }),
    },
  })
  expect(briefingCalls(calls)).toHaveLength(0)

  await clicker.click(panel.getByRole('button', { name: 'Tóm tắt hôm nay' }))
  const log = within(panel.getByRole('log'))
  expect(await log.findByText('Còn 600 credit, dưới ngưỡng 750.', {}, ANSWER)).toBeInTheDocument()
  expect(briefingCalls(calls)).toHaveLength(1)
  expect(briefingCalls(calls)[0]?.query).toStrictEqual({ locale: 'vi' })

  expect(log.getByText('Tóm tắt hôm nay')).toBeInTheDocument()
  expect(log.getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'TRIP-2026-1102 có 1 sự cố đã chuyển quản lý và 2 điểm có nguy cơ trễ.',
    'Còn 600 credit, dưới ngưỡng 750.',
  ])
  expect(log.getByText('Số liệu lúc 08:15.')).toBeInTheDocument()
  const links = within(log.getByRole('group', { name: 'Mở màn liên quan' }))
  expect(links.getAllByRole('link').map((link) => link.getAttribute('href'))).toStrictEqual(['/giam-sat', '/chuyen/TRIP-2026-1102'])
  expect(document.querySelector('[data-sonner-toast]')).toBeNull()
  expect(panel.queryByRole('button', { name: 'Tóm tắt hôm nay' })).not.toBeInTheDocument()
})

test('a company manager gets the button; a quiet day is one sentence', async () => {
  const { calls, clicker, panel } = await openPanel(person('US-0003', 'companyManager'), {
    [BRIEFING]: { body: envelope({ generatedAt: '2026-11-21T01:15:00Z', bullets: ['Hôm nay không có việc cần chú ý.'], links: [] }) },
  })
  await clicker.click(panel.getByRole('button', { name: 'Tóm tắt hôm nay' }))
  const log = within(panel.getByRole('log'))
  expect(await log.findByText('Hôm nay không có việc cần chú ý.', {}, ANSWER)).toBeInTheDocument()
  expect(log.queryByRole('listitem')).not.toBeInTheDocument()
  expect(log.queryByRole('group', { name: 'Mở màn liên quan' })).not.toBeInTheDocument()
  expect(briefingCalls(calls)).toHaveLength(1)
})

test.each([
  ['driver', person('US-0005', 'driver')],
  ['warehouse worker', person('US-0004', 'warehouse')],
  ['company admin', person('US-0001', 'companyAdmin')],
  ['customer support', person('US-NT-03', 'systemSupporter')],
])('a %s has no briefing button', async (_, user) => {
  const { calls, panel } = await openPanel(user)
  expect(panel.getByRole('group', { name: 'Câu hỏi gợi ý' })).toBeInTheDocument()
  expect(panel.queryByRole('button', { name: 'Tóm tắt hôm nay' })).not.toBeInTheDocument()
  expect(briefingCalls(calls)).toHaveLength(0)
})

test.each([
  ['the hourly limit', { status: 429, body: { success: false, code: 'ASSISTANT_RATE_LIMITED', message: 'x' } }, 'Bạn đã hỏi trợ lý quá nhiều lần trong một giờ. Thử lại sau.'],
  ['the model is down', { status: 503, body: { success: false, code: 'ASSISTANT_UNAVAILABLE', message: 'x' } }, 'Trợ lý AI tạm thời không trả lời được. Thử lại sau ít phút.'],
  ['a refused role', { status: 403, body: { success: false, message: 'x' } }, 'Bạn không có quyền thực hiện thao tác này.'],
])('a server error says the reason (%s)', async (_, reply, sentence) => {
  const { clicker, panel } = await openPanel(person('US-0002', 'dispatcher'), { [BRIEFING]: reply })
  await clicker.click(panel.getByRole('button', { name: 'Tóm tắt hôm nay' }))
  const log = within(panel.getByRole('log'))
  expect(await log.findByText(sentence, {}, ANSWER)).toBeInTheDocument()
  expect(log.queryByText('Chưa trả lời được câu này. Bạn thử gửi lại nhé.')).not.toBeInTheDocument()
})
