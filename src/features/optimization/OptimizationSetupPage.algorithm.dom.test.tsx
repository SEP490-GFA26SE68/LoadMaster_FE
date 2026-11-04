import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { OptimizationSetupPage } from './OptimizationSetupPage'

/**
 * Ô chọn thuật toán của Thiết lập tối ưu qua kho dùng chung: ba dòng, dòng gói chưa có hoặc bản demo chưa chạy được thì mờ kèm lý do
 * nối vào ô chọn, và lần chạy ghi đúng thuật toán đã chọn. Long Bình có gói Pro, Phương Nam gói Basic (seed). Kho từ chối thật ở
 * `billing.test.ts` và `optimization-api.test.ts`.
 */

function renderSetup(tripId: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/chuyen/${tripId}/toi-uu`]}>
          <Routes>
            <Route path="/chuyen/:tripId/toi-uu" element={<OptimizationSetupPage />} />
            <Route path="/chuyen/:tripId/so-sanh" element={<p>so-sanh</p>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function algorithmGroup() {
  // Lý do theo gói chỉ hiện khi đã đọc được gói: chờ thẻ Credit có số dư
  const credit = within(await screen.findByRole('region', { name: 'Credit' }))
  await credit.findByText(/^Lần chạy này dùng/)
  return within(screen.getByRole('radiogroup', { name: 'Thuật toán' }))
}

test('Long Bình (Pro): GA/SA is in the plan but the demo cannot run it; the AI Optimizer needs Ultimate', async () => {
  getMockDb().restoreSession('US-0001')
  renderSetup('TRIP-2026-0914')
  const group = await algorithmGroup()

  const basic = group.getByRole('radio', { name: 'EP + DBLF (mock)' })
  expect(basic).toBeChecked()
  expect(basic).toBeEnabled()

  const ga = group.getByRole('radio', { name: 'EP + DBLF + GA/SA' })
  expect(ga).toBeDisabled()
  expect(ga).toHaveAccessibleDescription(/Bản demo chỉ chạy EP \+ DBLF$/)

  const ai = group.getByRole('radio', { name: 'EP + DBLF + GA/SA + AI Optimizer' })
  expect(ai).toBeDisabled()
  expect(ai).toHaveAccessibleDescription(/Cần gói Ultimate$/)
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeEnabled()
})

test('Phương Nam (Basic): GA/SA needs Pro and the AI Optimizer needs Ultimate, each reason on its row', async () => {
  getMockDb().restoreSession('US-PN-03')
  renderSetup('TRIP-PN-001')
  const group = await algorithmGroup()

  expect(group.getByRole('radio', { name: 'EP + DBLF (mock)' })).toBeChecked()
  const ga = group.getByRole('radio', { name: 'EP + DBLF + GA/SA' })
  expect(ga).toBeDisabled()
  expect(ga).toHaveAccessibleDescription(/Cần gói Pro$/)
  const ai = group.getByRole('radio', { name: 'EP + DBLF + GA/SA + AI Optimizer' })
  expect(ai).toBeDisabled()
  expect(ai).toHaveAccessibleDescription(/Cần gói Ultimate$/)

  const rows = [...document.querySelectorAll('[data-algorithm-choice]')].map((row) => [row.getAttribute('data-algorithm-choice'), row.textContent])
  expect(rows).toStrictEqual([
    ['EP_DBLF', 'EP + DBLF (mock)Đặt từng kiện vào góc trống sâu nhất, thấp nhất. Nhanh, có ở mọi gói.'],
    ['EP_DBLF_GA', 'EP + DBLF + GA/SAThêm GA/SA thử nhiều thứ tự xếp để lấp đầy hơn; chạy lâu hơn.Cần gói Pro'],
    ['EP_DBLF_GA_AI', 'EP + DBLF + GA/SA + AI OptimizerThêm AI Optimizer trên nền GA/SA.Cần gói Ultimate'],
  ])
})

test('a run records the selected algorithm, and the running dialog names it', async () => {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const before = (await db.listOptimizationRuns('TRIP-2026-0914')).length
  renderSetup('TRIP-2026-0914')
  await algorithmGroup()
  const run = screen.getByRole('button', { name: 'Tối ưu' })
  await waitFor(() => expect(run).toBeEnabled())
  await userEvent.click(run)

  expect(await screen.findByText(/^EP \+ DBLF \(mock\) · random seed/)).toBeInTheDocument()
  expect(await screen.findByText('so-sanh', {}, { timeout: 25_000 })).toBeInTheDocument()
  const runs = await db.listOptimizationRuns('TRIP-2026-0914')
  expect(runs).toHaveLength(before + 1)
  expect(runs.at(-1)).toMatchObject({ status: 'COMPLETED', algorithm: 'EP_DBLF', by: 'US-0001' })
}, 30_000)
