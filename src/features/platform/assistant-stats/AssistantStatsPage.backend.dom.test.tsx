import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeReply } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import type { AssistantRouteStatsDto } from './assistant-stats-dto'
import { AssistantStatsPage } from './AssistantStatsPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['assistant']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant',
}))

const routes = (partial: Partial<AssistantRouteStatsDto['byRoute']>) => ({ SMALL_TALK: 0, PREPARED: 0, ESCALATED: 0, MODEL: 0, CACHED: 0, ...partial })

const STATS: AssistantRouteStatsDto = {
  from: '2026-10-26',
  to: '2026-11-24',
  total: 20,
  byRoute: routes({ SMALL_TALK: 2, PREPARED: 10, ESCALATED: 3, MODEL: 4, CACHED: 1 }),
  byTopic: [
    // 2 / 6 = 33,3 % với 6 lượt soạn sẵn: nên xem lại
    { topicId: 'plans', total: 12, byRoute: routes({ PREPARED: 6, ESCALATED: 2, MODEL: 3, CACHED: 1 }) },
    // 1 / 4 = 25 %: dưới ngưỡng
    { topicId: 'credit', total: 5, byRoute: routes({ PREPARED: 4, ESCALATED: 1 }) },
    { topicId: null, total: 3, byRoute: routes({ SMALL_TALK: 2, MODEL: 1 }) },
  ],
  byLocale: { vi: 15, en: 5 },
  partial: false,
}

let reply: FakeReply
let backend: ReturnType<typeof stubBackend>

beforeEach(() => {
  // "Hôm nay" theo giờ Việt Nam là 24/11/2026; chỉ giả Date để độ trễ và findBy… vẫn chạy thật
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-24T03:00:00Z'))
  connectApiAuth(() => Promise.resolve('token-1'))
  reply = { body: envelope(STATS) }
  backend = stubBackend({ 'GET /api/assistant/route-stats': () => reply })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function renderPage(route = '/nen-tang/tro-ly-lumo') {
  signedInAs('systemManager')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[route]}><AssistantStatsPage /></MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

const tile = (name: string) => screen.getByRole('group', { name })

test('reads the last 30 days by default and shows the counts, ratios and locales the server returned', async () => {
  renderPage()

  expect(await screen.findByRole('group', { name: 'Tổng lượt' })).toHaveTextContent('20')
  expect(backend.calls.map((call) => [call.method, call.path, call.query])).toStrictEqual([
    ['GET', '/api/assistant/route-stats', { from: '2026-10-26', to: '2026-11-24' }],
  ])
  // (2 câu xã giao + 10 soạn sẵn + 1 bộ nhớ đệm) / 20
  expect(tile('Trả ngay, không gọi mô hình')).toHaveTextContent('65,0%')
  expect(tile('Lượt gọi mô hình')).toHaveTextContent('4')
  // 3 lượt hỏi chi tiết / 10 lượt soạn sẵn
  expect(tile('Tỉ lệ hỏi chi tiết')).toHaveTextContent('30,0%')
  expect(screen.getByText('Số chỉ đếm lượt theo đường trả lời, chủ đề và ngôn ngữ — không chứa chữ khách gõ hay mã khách.')).toBeInTheDocument()

  const byRoute = screen.getByRole('region', { name: 'Theo đường trả lời' })
  const cached = within(byRoute).getByRole('row', { name: /Lấy lại từ bộ nhớ đệm/ })
  expect(cached).toHaveTextContent('5,0%')

  const locales = screen.getByRole('heading', { name: 'Theo ngôn ngữ' }).closest('div')?.parentElement
  expect(locales).toHaveTextContent('Tiếng Việt15 · 75,0%')
  expect(locales).toHaveTextContent('Tiếng Anh5 · 25,0%')
  expect(screen.queryByText(/Máy chủ không đọc được nơi lưu bền/)).not.toBeInTheDocument()
})

test('marks only topics from 30 % escalations with at least 5 prepared answers, and names the unknown topic', async () => {
  renderPage()
  const topics = await screen.findByRole('region', { name: 'Theo chủ đề' })

  const plans = within(topics).getByRole('row', { name: /Giá các gói\?/ })
  expect(plans).toHaveTextContent('Nên xem lại câu soạn sẵn')
  expect(plans).toHaveTextContent('33,3%')
  const credit = within(topics).getByRole('row', { name: /Một lần tối ưu tốn bao nhiêu credit\?/ })
  expect(credit).not.toHaveTextContent('Nên xem lại câu soạn sẵn')
  const unknown = within(topics).getByRole('row', { name: /Không rõ chủ đề/ })
  // Không có lượt soạn sẵn: không có tỉ lệ, không có nhãn
  expect(unknown).toHaveTextContent('—')
  expect(within(topics).getAllByText('Nên xem lại câu soạn sẵn')).toHaveLength(1)
})

test('warns when the server could only count what one instance kept in memory', async () => {
  reply = { body: envelope({ ...STATS, partial: true }) }
  renderPage()
  expect(await screen.findByText(/Máy chủ không đọc được nơi lưu bền/)).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Tổng lượt' })).toHaveTextContent('20')
})

test('an empty period is a sentence, not a table of zeros', async () => {
  reply = { body: envelope({ ...STATS, total: 0, byRoute: routes({}), byTopic: [], byLocale: {} }) }
  renderPage()
  expect(await screen.findByText('Chưa có lượt hỏi nào')).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Tổng lượt' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Theo chủ đề' })).not.toBeInTheDocument()
})

test('a load error says what went wrong and can be retried', async () => {
  reply = { status: 500, body: { success: false, code: 'SERVER_ERROR', message: 'boom' } }
  const user = renderPage()
  expect(await screen.findByText('Chưa tải được số đếm của trợ lý')).toBeInTheDocument()
  expect(screen.getByText('Máy chủ gặp lỗi. Thử lại sau.')).toBeInTheDocument()

  reply = { body: envelope(STATS) }
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('group', { name: 'Tổng lượt' })).toHaveTextContent('20')
})

test('the form refuses more than 90 days and says why; quick ranges reload with the new dates', async () => {
  const user = renderPage()
  await screen.findByRole('group', { name: 'Tổng lượt' })

  const from = screen.getByLabelText('Từ ngày')
  await user.clear(from)
  await user.type(from, '2026-08-26')
  await user.click(screen.getByRole('button', { name: 'Xem' }))
  expect(await screen.findByText('Máy chủ đếm tối đa 90 ngày một lần — khoảng này dài 91 ngày.')).toBeInTheDocument()
  expect(backend.calls).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: '7 ngày gần nhất' }))
  await waitFor(() => expect(backend.calls.at(-1)?.query).toStrictEqual({ from: '2026-11-18', to: '2026-11-24' }))
  expect(screen.getByRole('button', { name: '7 ngày gần nhất' })).toHaveAttribute('aria-pressed', 'true')
})

test('dates from the URL are what the screen asks for; an unreadable range asks the reader to pick again', async () => {
  renderPage('/nen-tang/tro-ly-lumo?tu=2026-11-01&den=2026-11-10')
  await screen.findByRole('group', { name: 'Tổng lượt' })
  expect(backend.calls[0]?.query).toStrictEqual({ from: '2026-11-01', to: '2026-11-10' })
})

test('a range longer than the server allows on the URL is never sent', async () => {
  renderPage('/nen-tang/tro-ly-lumo?tu=2026-01-01&den=2026-11-24')
  expect(await screen.findByRole('alert')).toHaveTextContent('Khoảng ngày trên đường dẫn không đọc được')
  expect(backend.calls).toHaveLength(0)
})
