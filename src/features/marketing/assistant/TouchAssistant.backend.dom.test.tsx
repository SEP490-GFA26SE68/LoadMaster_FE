import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { DriverStopHeader } from '@/features/driver/DriverStopHeader'
import { StepHeader } from '@/features/warehouse/StepHeader'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import type { Role } from '@/types/user'
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
 * Nút "Trợ lý AI" trên thanh dải trời của màn cảm ứng (kho, tài xế) khi nhóm `assistant` nối máy chủ: nằm trong thanh, cùng điều kiện với
 * nút của khung ứng dụng (không có khi bị gắn cờ, công ty hết gói), mở bản cảm ứng của khung chat với câu gợi ý của vai trò.
 */
const ANSWER = { timeout: 4000 }

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

const person = (id: string, role: Role, extra: Partial<MockUser> = {}): MockUser =>
  ({ id, fullName: 'Trần Văn Bình', email: `${id.toLowerCase()}@longbinh.vn`, role, status: 'active', ...extra })

const STOPS = [{ number: 1 }, { number: 2 }, { number: 3 }]

function shell(path: string, screenNode: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>{screenNode}</MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

const driverStop = () => shell('/tai-xe/diem-giao?chuyen=42', <DriverStopHeader stop={{ number: 2 }} stops={STOPS} completedStops={new Set([1])} />)
const warehouseStep = () => shell('/kho?chuyen=42', <StepHeader step={3} totalSteps={20} recorded={2} tripId="42" code="TRIP-2026-0914" />)

beforeEach(() => {
  auth.user = null
})

afterEach(() => {
  cleanup()
  assistantSession.reset()
  sessionStorage.clear()
  document.documentElement.style.removeProperty('--assistant-touch-top')
  vi.unstubAllGlobals()
})

test.each([
  ['the driver stop screen', person('US-0005', 'driver'), driverStop],
  ['the warehouse loading screen', person('US-0004', 'warehouse'), warehouseStep],
])('%s has a 56 px "AI assistant" button on its sky bar', (_, user, view) => {
  auth.user = user
  render(view())
  const button = within(screen.getByRole('banner')).getByRole('button', { name: 'Trợ lý AI' })
  expect(button).toHaveClass('size-14')
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  // Đáy thanh được ghi lại để khung chat (từ 768 px) đứng ngay dưới thanh
  expect(document.documentElement.style.getPropertyValue('--assistant-touch-top')).toMatch(/px$/)
})

test.each([
  ['nobody is signed in', null],
  ['the account is flagged', person('US-0005', 'driver', { status: 'flagged' })],
  ['the company has no active plan', person('US-0004', 'warehouse', { subscriptionExpired: true })],
])('no assistant button on the touch bar when %s', (_, user) => {
  auth.user = user
  render(driverStop())
  expect(screen.queryByRole('button', { name: 'Trợ lý AI' })).not.toBeInTheDocument()
})

test('a driver opens the touch panel, sees driver questions and asks one from the stop screen', async () => {
  const { calls } = stubBackend({
    'POST /api/assistant/messages': { body: envelope({ conversationId: 'c-1', reply: 'Điểm kế tiếp là điểm 2.', uiActions: [], links: [], handoff: { offered: false, ticketCode: null } }) },
  })
  auth.user = person('US-0005', 'driver')
  render(driverStop())
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  const dialog = await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER)
  expect(dialog).toHaveClass('assistant-touch')
  expect(dialog).toHaveAttribute('data-dock', 'touch')
  expect(screen.getByRole('button', { name: 'Trợ lý AI' })).toHaveAttribute('aria-expanded', 'true')
  const panel = within(dialog)
  const starters = panel.getByRole('group', { name: 'Câu hỏi gợi ý' })
  expect(within(starters).getAllByRole('button').map((b) => b.textContent)).toStrictEqual([
    'Màn này dùng để làm gì?',
    'Hôm nay tôi chạy chuyến nào, điểm giao kế tiếp ở đâu?',
    'Phiếu lương tháng này của tôi thế nào?',
    'Yêu cầu hỗ trợ của tôi tới đâu rồi?',
  ])
  expect(panel.getByRole('button', { name: 'Gửi câu hỏi' })).toHaveClass('in-[.assistant-touch]:size-14')

  await user.click(within(starters).getByRole('button', { name: 'Hôm nay tôi chạy chuyến nào, điểm giao kế tiếp ở đâu?' }))
  expect(await panel.findByText('Điểm kế tiếp là điểm 2.', {}, ANSWER)).toBeInTheDocument()
  expect((calls[0] as FakeCall).body).toMatchObject({ message: 'Hôm nay tôi chạy chuyến nào, điểm giao kế tiếp ở đâu?', page: { path: '/tai-xe/diem-giao?chuyen=42' } })
})

test('a warehouse worker gets warehouse questions', async () => {
  auth.user = person('US-0004', 'warehouse')
  render(warehouseStep())
  await userEvent.setup().click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  const panel = within(await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER))
  expect(within(panel.getByRole('group', { name: 'Câu hỏi gợi ý' })).getAllByRole('button').map((b) => b.textContent)).toStrictEqual([
    'Màn này dùng để làm gì?',
    'Hôm nay kho có chuyến nào chờ soạn, chờ xếp?',
    'Tra giúp tôi một kiện theo mã',
    'Phiếu lương tháng này của tôi thế nào?',
  ])
})
