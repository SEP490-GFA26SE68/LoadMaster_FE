import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { CurrentSubscriptionDto } from '@/lib/billing-backend-api'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { envelope, useFakeBackend } from '@/test/billing-backend-fetch'
import { OptimizationSetupPage } from './OptimizationSetupPage'

/**
 * Thẻ Credit của Thiết lập tối ưu khi nhóm `billing` nối backend: số dư và gói là của backend (chuyến vẫn từ kho mẫu). Gói đã hết hạn mà
 * backend không còn trả tên gói thì thẻ nói số dư kèm lý do, không nói "chưa có gói", và nút Tối ưu mờ trước khi bấm.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()

const PRO: CurrentSubscriptionDto = {
  subscriptionId: 1, planId: 2, planName: 'Pro', tier: 'PRO', status: 'ACTIVE', startedAt: '2026-09-01T08:00:00', expiresAt: '2026-10-01T08:00:00',
  autoRenew: true, creditsBalance: 1200, creditsMonthlyGrant: 500, algorithmTier: 'EP_DBLF_GA',
}

function serve(current: CurrentSubscriptionDto, balance: number) {
  backend.routes['GET /api/subscription/current'] = envelope(current)
  backend.routes['GET /api/credits/balance'] = envelope({ companyId: 1, balance, isUnlimited: false })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T05:00:00.000Z'))
  getMockDb().restoreSession('US-0001')
})

afterEach(() => {
  vi.useRealTimers()
})

function renderSetup() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/chuyen/TRIP-2026-0914/toi-uu']}>
          <Routes><Route path="/chuyen/:tripId/toi-uu" element={<OptimizationSetupPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const runButton = () => screen.getByRole('button', { name: 'Tối ưu' })

test('the balance and plan come from the backend, not from the sample store', async () => {
  serve(PRO, 1200)
  renderSetup()
  const panel = within(await screen.findByRole('region', { name: 'Credit' }))
  expect(await panel.findByText('Lần chạy này dùng 1 credit · còn 1.200')).toBeInTheDocument()
  expect(panel.getByText('Hạng thuật toán của gói Pro')).toBeInTheDocument()
  expect(panel.queryByRole('alert')).toBeNull()
  expect(runButton()).toBeEnabled()
})

test('a plan the backend reports expired: the balance with the reason, not "no plan"; Optimize dimmed before the click', async () => {
  serve({ ...PRO, subscriptionId: null, planId: null, planName: null, tier: null, status: 'EXPIRED', startedAt: null, expiresAt: null, autoRenew: null, algorithmTier: null }, 40)
  renderSetup()
  const panel = within(await screen.findByRole('region', { name: 'Credit' }))
  expect(await panel.findByRole('alert')).toHaveTextContent('Gói cước đã hết hạn — liên hệ quản trị công ty')
  expect(panel.getByText('Lần chạy này dùng 1 credit · còn 40')).toBeInTheDocument()
  expect(panel.queryByText('Công ty chưa có gói cước.')).toBeNull()
  expect(runButton()).toBeDisabled()
  expect(runButton()).toHaveAccessibleDescription('Gói cước đã hết hạn — liên hệ quản trị công ty')
})
