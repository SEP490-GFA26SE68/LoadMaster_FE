import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { CurrentSubscriptionDto, PlanDto } from '@/lib/billing-backend-api'
import { I18nProvider } from '@/lib/i18n'
import { envelope, useFakeBackend } from '@/test/billing-backend-fetch'
import { BillingPage } from './BillingPage'

/**
 * Gói cước và credit khi nối backend: gói và số dư của backend, giá credit 5.000 đ, lịch sử có hoá đơn thay cho thanh toán (backend chưa
 * cho đọc giao dịch thanh toán), đăng ký và nạp mở trang xác nhận của app với mã giao dịch của cổng thử.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()
const SLOW = { timeout: 5000 }

const BASIC: PlanDto = {
  id: 1, planCode: 'BASIC', name: 'Basic', priceVnd: 490000, tier: 'BASIC', monthlyCredits: 100, algorithmTier: 'EP_DBLF',
  features: '["OPTIMIZATION_3D"]', billingCycle: 'MONTHLY', maxVehicles: 5, maxMonthlyJobs: 100, active: true, activeCompanyCount: 1,
}
const PRO: PlanDto = { ...BASIC, id: 2, planCode: 'PRO', name: 'Pro', priceVnd: 1490000, tier: 'PRO', monthlyCredits: 500, algorithmTier: 'EP_DBLF_GA' }
const ACTIVE: CurrentSubscriptionDto = {
  subscriptionId: 1, planId: 2, planName: 'Pro', tier: 'PRO', status: 'ACTIVE', startedAt: '2026-10-01T08:00:00', expiresAt: '2026-11-01T08:00:00',
  autoRenew: true, creditsBalance: 1200, creditsMonthlyGrant: 500, algorithmTier: 'EP_DBLF_GA',
}
const LEDGER = envelope({
  content: [
    { id: 4, amount: 200, type: 'PURCHASE', reference: 'MOCK_09D3DE34151E4578', refunded: false, createdAt: '2026-10-10T14:21:00' },
    { id: 2, amount: 500, type: 'MONTHLY_GRANT', reference: 'CONTRACT-1', refunded: false, createdAt: '2026-10-01T08:05:00' },
  ],
  last: true,
})
const INVOICE = {
  id: 1, invoiceNumber: 'INV-1-1792203135003', companyId: 1, companyName: 'Vận tải Long Bình', companySubscriptionId: 1, planName: 'Pro',
  amount: 1490000, status: 'PAID', billingPeriod: '2026-10', createdAt: '2026-10-01T01:05:00Z', paidAt: '2026-10-01T08:05:00',
}

function PaymentProbe() {
  return <p>Đang ở {useLocation().pathname}{useLocation().search}</p>
}

function renderBilling() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/goi-cuoc']}>
          <Routes>
            <Route path="/goi-cuoc" element={<BillingPage />} />
            <Route path="/thanh-toan/ket-qua" element={<PaymentProbe />} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function serve(current: CurrentSubscriptionDto, balance: number) {
  backend.routes['GET /api/subscription/current'] = envelope(current)
  backend.routes['GET /api/subscription/plans/2'] = PRO
  backend.routes['GET /api/subscription/plans'] = [PRO, BASIC]
  backend.routes['GET /api/credits/balance'] = envelope({ companyId: 1, balance, isUnlimited: false })
  backend.routes['GET /api/credits/transactions?page=0&size=100'] = LEDGER
  backend.routes['GET /api/company/invoices'] = [INVOICE]
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-17T03:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const rowsOf = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

test('the plan and balance of the backend; credit and invoice history, no payments tab', async () => {
  const user = userEvent.setup()
  serve(ACTIVE, 1200)
  renderBilling()
  const plan = within(await screen.findByRole('region', { name: 'Gói hiện tại' }, SLOW))
  for (const text of ['Đang hoạt động', '1.490.000 ₫', '500', '01/11/2026']) expect(plan.getByText(text)).toBeInTheDocument()
  expect(plan.queryByText('Giá trị tạm — chờ chốt')).toBeNull()
  expect(plan.queryByText('Tự gia hạn')).toBeNull()
  expect(within(screen.getByRole('group', { name: 'Số dư' })).getByText('1.200')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Chọn gói' })).toBeNull()

  await waitFor(() => expect(rowsOf()).toHaveLength(2), SLOW)
  await waitFor(() => expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toStrictEqual(['Credit2', 'Hoá đơn1']))
  expect(within(rowsOf()[0] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('Mua')

  await user.click(screen.getByRole('tab', { name: /Hoá đơn/ }))
  await waitFor(() => expect(rowsOf()).toHaveLength(1))
  expect(within(rowsOf()[0] as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent?.replace(/\s+/g, ' ')).slice(1))
    .toStrictEqual(['INV-1-1792203135003', '2026-10', 'Pro', '1.490.000 ₫', 'Đã trả'])
})

test('topping up at the backend price opens the confirmation page with the gateway transaction code', async () => {
  const user = userEvent.setup()
  serve(ACTIVE, 1200)
  backend.routes['POST /api/credits/topup'] = envelope({ id: 8, transactionId: 'MOCK_TOPUP1', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_TOPUP1', status: 'PENDING' })
  renderBilling()
  await user.click(await screen.findByRole('button', { name: 'Nạp credit' }, SLOW))
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('5.000 ₫ mỗi credit')
  expect(dialog).toHaveTextContent('250.000 ₫')
  await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' }))
  expect(await screen.findByText('Đang ở /thanh-toan/ket-qua?ma=MOCK_TOPUP1&loai=credit', {}, SLOW)).toBeInTheDocument()
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({ url: 'http://be.test/api/credits/topup', body: { credits: 50, gateway: 'MOCK' } })
})

test('an expired plan the backend no longer names: says so, offers the plans and subscribes through the gateway', async () => {
  const user = userEvent.setup()
  serve({ ...ACTIVE, subscriptionId: null, planId: null, planName: null, tier: null, status: 'EXPIRED', startedAt: null, expiresAt: null, autoRenew: null }, 0)
  backend.routes['POST /api/subscription/subscribe'] = envelope({ id: 9, transactionId: 'MOCK_SUB1', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_SUB1', status: 'PENDING' })
  renderBilling()
  expect(await screen.findByText('Gói cước của công ty đã hết hạn', {}, SLOW)).toBeInTheDocument()
  const choose = within(screen.getByRole('region', { name: 'Chọn gói' }))
  await user.click(choose.getByRole('button', { name: 'Đăng ký gói Basic' }))
  expect(await screen.findByText('Đang ở /thanh-toan/ket-qua?ma=MOCK_SUB1&loai=goi', {}, SLOW)).toBeInTheDocument()
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({ body: { planId: 1, gateway: 'MOCK' } })
})
