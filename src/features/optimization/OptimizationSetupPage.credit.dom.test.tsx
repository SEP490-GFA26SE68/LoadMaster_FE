import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { OptimizationSetupPage } from './OptimizationSetupPage'

/**
 * Credit trên Thiết lập tối ưu (FE-8-05, D-89) qua kho dùng chung: dòng "Lần chạy này dùng 1 credit · còn N", hạng thuật toán của gói
 * và hai trạng thái bị chặn — hết credit, gói hết hạn — hiện mờ kèm lý do trước khi bấm. Kho chặn thật được kiểm ở `billing.test.ts`.
 * Mỗi test mở một công ty (phiên của điều phối viên) và test cuối đẩy đồng hồ của kho — chỉ giả `Date`, kho dùng chung của file này.
 */
const NOW = new Date('2026-09-14T05:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

function renderSetup(tripId: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/chuyen/${tripId}/toi-uu`]}>
          <Routes><Route path="/chuyen/:tripId/toi-uu" element={<OptimizationSetupPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const runButton = () => screen.getByRole('button', { name: 'Tối ưu' })

test('a company with credits sees what one run costs and the algorithm tier of its plan; Optimize stays enabled', async () => {
  getMockDb().restoreSession('US-0001')
  renderSetup('TRIP-2026-0914')
  const panel = within(await screen.findByRole('region', { name: 'Credit' }))
  expect(await panel.findByText('Lần chạy này dùng 1 credit · còn 486')).toBeInTheDocument()
  expect(panel.getByText('Hạng thuật toán của gói Pro')).toBeInTheDocument()
  expect(panel.getByText('EP + DBLF + GA/SA')).toBeInTheDocument()
  expect(panel.queryByText('AI Optimizer — chưa có')).toBeNull()
  expect(panel.queryByRole('alert')).toBeNull()
  expect(runButton()).toBeEnabled()
})

test('with no credit left Optimize is dimmed before the click, with the dispatcher wording', async () => {
  const db = getMockDb()
  db.restoreSession('US-PN-03')
  await db.reserveOptimizationCredit('TRIP-PN-001')
  await db.reserveOptimizationCredit('TRIP-PN-001')
  renderSetup('TRIP-PN-001')
  const panel = within(await screen.findByRole('region', { name: 'Credit' }))
  expect(await panel.findByRole('alert')).toHaveTextContent('Hết credit — liên hệ quản trị công ty')
  expect(panel.getByText('Lần chạy này dùng 1 credit · còn 0')).toBeInTheDocument()
  expect(runButton()).toBeDisabled()
  expect(runButton()).toHaveAccessibleDescription('Hết credit — liên hệ quản trị công ty')
})

test('with the plan expired Optimize is dimmed too, and the credits left are shown as they were', async () => {
  const db = getMockDb()
  db.restoreSession('US-LB-01')
  const { subscription } = (await db.getCurrentSubscription()) ?? {}
  await db.cancelSubscription()
  vi.setSystemTime(Date.parse(subscription?.expiresAt ?? '') + 1000)
  db.restoreSession('US-0001')
  renderSetup('TRIP-2026-0914')
  const panel = within(await screen.findByRole('region', { name: 'Credit' }))
  expect(await panel.findByRole('alert')).toHaveTextContent('Gói cước đã hết hạn — liên hệ quản trị công ty')
  expect(panel.getByText('Lần chạy này dùng 1 credit · còn 486')).toBeInTheDocument()
  expect(runButton()).toBeDisabled()
  expect(runButton()).toHaveAccessibleDescription('Gói cước đã hết hạn — liên hệ quản trị công ty')
})
