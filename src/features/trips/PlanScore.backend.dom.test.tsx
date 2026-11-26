import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { PlanComparisonPage } from './PlanComparisonPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Điểm J ở So sánh theo lần chạy (máy chủ): mỗi thẻ một dòng "Điểm phương án" theo hồ sơ của nó, phân rã sau "Tính thế nào?", không
 * "Tốt nhất" trên J (một câu nói vì sao), ứng viên trùng cách xếp mang nhãn "Giống hệt phương án …". Máy chủ không chấm thì không có gì.
 */
const plan = (id: number, label: string, extra: object = {}) => ({
  id, tripId: 42, jobUuid: 'job-1', objective: null, candidateLabel: label, algorithmName: 'EP_DBLF', computationMs: null,
  volumeUtilization: '0.6', weightUtilization: null, approved: false, approvedByName: null, rehandlingCount: null, placements: [], unplaced: [],
  ...extra,
})

const SCORE_A = { profile: 'A', profileName: 'Max volume', assumedWeights: true, j: '5.17', uVol: '0.625', uN: '0.9', wVol: '0.6', wN: '0.4',
  components: [
    { code: 'S1', name: 'Rehandling', value: '0.25', weight: '0.3', contribution: '-7.5', computed: true },
    { code: 'S3', name: 'Axle balance', value: null, weight: '0.1', contribution: null, computed: false },
  ] }

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderComparison() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/chuyen/TRIP-42/so-sanh?lan-chay=job-1']}>
          <Routes><Route path="/chuyen/:tripId/so-sanh" element={<PlanComparisonPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const cardOf = (heading: HTMLElement) => heading.closest('header')!.parentElement!

test('dòng điểm theo hồ sơ, phân rã sau "Tính thế nào?", không "Tốt nhất" trên điểm, nhãn trùng cách xếp', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([
      plan(1, 'A', { candidateProfile: 'A', planScore: SCORE_A }),
      plan(2, 'B', { candidateProfile: 'B', duplicateOf: 'A', planScore: { profile: 'B', j: '12.04', assumedWeights: false } }),
      plan(3, 'C', { candidateProfile: 'C', planScore: { profile: 'NEW_PROFILE', j: '-3.25' } }),
    ]) },
  })
  renderComparison()
  const [a, b, c] = await screen.findAllByRole('heading', { level: 2 })
  const cardA = cardOf(a!)
  expect(within(cardA).getByText('Điểm phương án')).toBeInTheDocument()
  expect(within(cardA).getByText('theo hồ sơ Chở nhiều')).toBeInTheDocument()
  expect(within(cardA).getByText('5,2')).toBeInTheDocument()
  expect(within(cardOf(b!)).getByText('12,0')).toBeInTheDocument()
  expect(within(cardOf(b!)).getByText('theo hồ sơ An toàn tải')).toBeInTheDocument()
  // Hồ sơ lạ hiện nguyên mã
  expect(within(cardOf(c!)).getByText('theo hồ sơ NEW_PROFILE')).toBeInTheDocument()
  expect(within(cardOf(c!)).getByText('-3,3')).toBeInTheDocument()

  // Không "Tốt nhất" trên điểm: một câu cho cả lần chạy
  expect(screen.getAllByText(/không có "Tốt nhất"/)).toHaveLength(1)
  expect(screen.queryAllByText('Tốt nhất')).toHaveLength(0)

  // Trùng cách xếp: chỉ phương án B mang nhãn
  expect(b!.textContent).toBe('Phương án BGiống hệt phương án A')
  expect(screen.getAllByText(/Giống hệt phương án/)).toHaveLength(1)

  const toggle = within(cardA).getByRole('button', { name: 'Tính thế nào? — Điểm phương án A' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(within(cardA).queryByText('Giá trị 25,0% × trọng số 0,30 → trừ 7,5 điểm.')).not.toBeInTheDocument()
  await userEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(within(cardA).getByText('Lấp đầy 62,5% × trọng số 0,60 → cộng 37,5 điểm.')).toBeInTheDocument()
  expect(within(cardA).getByText('Kiện xếp được 90,0% × trọng số 0,40 → cộng 36,0 điểm.')).toBeInTheDocument()
  expect(within(cardA).getByText('S1 · Dỡ-xếp lại')).toBeInTheDocument()
  expect(within(cardA).getByText('Giá trị 25,0% × trọng số 0,30 → trừ 7,5 điểm.')).toBeInTheDocument()
  expect(within(cardA).getByText('S3 · Mất cân bằng hai trục')).toBeInTheDocument()
  expect(within(cardA).getByText('Không tính: xe chưa khai đủ dữ liệu trục.')).toBeInTheDocument()
  expect(within(cardA).getByText('Trọng số là số tạm, chưa chốt.')).toBeInTheDocument()
  // Tên máy chủ không lên màn: dịch theo mã
  expect(screen.queryByText(/Max volume|Rehandling|Axle balance/)).not.toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()

  // Trọng số đã chốt thì không có câu số tạm
  await userEvent.click(within(cardOf(b!)).getByRole('button', { name: 'Tính thế nào? — Điểm phương án B' }))
  expect(within(cardOf(b!)).queryByText('Trọng số là số tạm, chưa chốt.')).not.toBeInTheDocument()
})

test('máy chủ chưa chấm: không dòng điểm, không nút "Tính thế nào?", không câu về "Tốt nhất", không nhãn trùng', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([plan(1, 'A'), plan(2, 'B', { planScore: null, duplicateOf: null })]) },
  })
  renderComparison()
  expect(await screen.findAllByRole('heading', { level: 2 })).toHaveLength(2)
  expect(screen.queryByText('Điểm phương án')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Tính thế nào/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/không có "Tốt nhất"/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Giống hệt phương án/)).not.toBeInTheDocument()
})
