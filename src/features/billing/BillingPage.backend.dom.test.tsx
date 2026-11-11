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
 * Gói cước và credit khi nối backend: gói và số dư của backend, giá credit theo hạng gói, lịch sử có hoá đơn thay cho thanh toán (backend chưa
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
    { id: 5, amount: 1, type: 'REFUND', reference: 'JOB-102', refunded: false, createdAt: '2026-10-12T09:15:00' },
    { id: 4, amount: 200, type: 'PURCHASE', reference: 'MOCK_09D3DE34151E4578', refunded: false, createdAt: '2026-10-10T14:21:00' },
    { id: 3, amount: -1, type: 'USAGE', reference: 'JOB-101', refunded: false, createdAt: '2026-10-05T11:00:00' },
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

/** Gia hạn của máy chủ: mặc định gói còn hạn ngoài kỳ gia hạn, không thanh toán nào chờ. */
const RENEWAL_NOT_DUE = {
  planId: 2, planName: 'Pro', tier: 'PRO', planActive: true, status: 'ACTIVE', expiresAt: '2026-11-01T08:00:00', amountVnd: 1490000,
  renewable: false, reason: 'NOT_DUE', renewalWindowDays: 3, pendingPayment: null,
}

function serve(current: CurrentSubscriptionDto, balance: number, renewal: unknown = RENEWAL_NOT_DUE) {
  backend.routes['GET /api/subscription/current'] = envelope(current)
  backend.routes['GET /api/subscription/renewal'] = envelope(renewal)
  backend.routes['GET /api/credits/pricing'] = envelope({
    tier: current.tier ?? 'BASIC', pricePerCreditVnd: current.tier === 'PRO' ? 326 : 400, tierPrices: { BASIC: 400, PRO: 326, ULTIMATE: 263 },
    optimizationCost: 2, rerunCost: 1, minTopUpCredits: 1, maxTopUpCredits: null, unlimited: false, topUpAllowed: current.status === 'ACTIVE' || current.status === null,
    lowBalanceThreshold: 10,
  })
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
  // Tên gói "Pro" đã nói hạng: không kèm nhãn hạng "Pro" lần nữa
  expect(plan.getAllByText('Pro')).toHaveLength(1)
  expect(plan.queryByText('Giá trị tạm — chờ chốt')).toBeNull()
  expect(plan.queryByText('Tự gia hạn')).toBeNull()
  expect(within(screen.getByRole('group', { name: 'Số dư' })).getByText('1.200')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Số dư' })).getByText('Mỗi lần chạy tối ưu dùng 2 credit, kể cả chạy lại giữ kiện đã ghim.')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Chọn gói' })).toBeNull()

  await waitFor(() => expect(rowsOf()).toHaveLength(2), SLOW)
  await waitFor(() => expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toStrictEqual(['Credit2', 'Hoá đơn1', 'Trừ / Hoàn credit2']))
  expect(within(rowsOf()[0] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('Mua')
  // Tham chiếu dài của máy chủ cắt trong cột, đủ chữ ở title
  const reference = within(rowsOf()[0] as HTMLElement).getAllByRole('cell')[3]?.firstElementChild
  expect(reference).toHaveAttribute('title', 'MOCK_09D3DE34151E4578')
  expect(reference).toHaveClass('truncate')

  await user.click(screen.getByRole('tab', { name: /Hoá đơn/ }))
  await waitFor(() => expect(rowsOf()).toHaveLength(1))
  expect(within(rowsOf()[0] as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent?.replace(/\s+/g, ' ')).slice(1))
    .toStrictEqual(['INV-1-1792203135003', '10/2026', 'Pro', '1.490.000 ₫', 'Đã trả'])

  await user.click(screen.getByRole('tab', { name: /Trừ \/ Hoàn credit/ }))
  await waitFor(() => expect(rowsOf()).toHaveLength(2))
  expect(within(rowsOf()[0] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('Hoàn')
  expect(within(rowsOf()[1] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('Dùng')
  expect(within(rowsOf()[1] as HTMLElement).getAllByRole('cell')[4]).toHaveTextContent('Đã trừ')
})

test('topping up at the backend price shows monthly reset warning without cap and opens the confirmation page', async () => {
  const user = userEvent.setup()
  serve(ACTIVE, 1200)
  backend.routes['POST /api/credits/topup'] = envelope({ id: 8, transactionId: 'MOCK_TOPUP1', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_TOPUP1', status: 'PENDING' })
  renderBilling()
  await user.click(await screen.findByRole('button', { name: 'Nạp credit' }, SLOW))
  const dialog = await screen.findByRole('dialog')
  // Gói Pro: 326 đ mỗi credit, không giới hạn trần mua lẻ, có cảnh báo qua tháng mới vẫn reset về credit ban đầu của gói
  expect(dialog).toHaveTextContent('326 ₫ mỗi credit')
  expect(dialog).toHaveTextContent('16.300 ₫')
  expect(dialog).toHaveTextContent(/chỉ.*trong tháng.*qua tháng.*reset về/i)
  expect(dialog).not.toHaveTextContent('còn nạp được')
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

test('an expired plan the server can renew: renews that same plan (even off sale) through the gateway; credits cannot be topped up', async () => {
  const user = userEvent.setup()
  serve({ ...ACTIVE, subscriptionId: null, planId: null, planName: null, tier: null, status: 'EXPIRED', startedAt: null, expiresAt: null, autoRenew: null }, 40, {
    ...RENEWAL_NOT_DUE, planActive: false, status: 'EXPIRED', expiresAt: '2026-10-10T08:00:00', renewable: true, reason: null,
  })
  backend.routes['POST /api/subscription/renew'] = envelope({ id: 13, transactionId: 'MOCK_RENEW1', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_RENEW1', status: 'PENDING', amountVnd: 1490000 })
  renderBilling()
  expect(await screen.findByText(/Gói Pro đã hết hạn ngày 10\/10\/2026\. Gia hạn đúng gói này \(1\.490\.000 ₫ một kỳ\).*Gói Pro đã ngừng bán/, {}, SLOW)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Nạp credit' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('Gói cước đã hết hạn nên chưa nạp được credit. Gia hạn hoặc chọn gói mới trước.')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' })).toBeDisabled()
  await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))
  await user.click(screen.getByRole('button', { name: 'Gia hạn gói Pro' }))
  expect(await screen.findByText('Đang ở /thanh-toan/ket-qua?ma=MOCK_RENEW1&loai=goi', {}, SLOW)).toBeInTheDocument()
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({ url: 'http://be.test/api/subscription/renew', body: { gateway: 'MOCK' } })
})

test('a waiting plan payment of the server has a banner whose Pay opens its confirmation page', async () => {
  const user = userEvent.setup()
  serve(ACTIVE, 1200, {
    ...RENEWAL_NOT_DUE,
    pendingPayment: { id: 14, transactionId: 'MOCK_WAIT1', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_WAIT1', orderType: 'SUBSCRIPTION_RENEWAL', planId: 2, amountVnd: 1490000, createdAt: '2026-10-16T08:00:00' },
  })
  renderBilling()
  expect(await screen.findByText('Thanh toán gia hạn gói Pro (1.490.000 ₫) đang chờ. Gói hết hạn ngày 01/11/2026 nếu chưa trả.', {}, SLOW)).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Trả' }))
  expect(await screen.findByText('Đang ở /thanh-toan/ket-qua?ma=MOCK_WAIT1&loai=goi', {}, SLOW)).toBeInTheDocument()
})

test('a plan still running renews itself; upgrading to a higher tier warns about credit reset to 0 and subscribes directly', async () => {
  const user = userEvent.setup()
  serve(ACTIVE, 1200)
  const ULTIMATE: PlanDto = { ...BASIC, id: 3, planCode: 'ULTIMATE', name: 'Ultimate', priceVnd: 4990000, tier: 'ULTIMATE', monthlyCredits: null, algorithmTier: 'EP_DBLF_GA_AI' }
  backend.routes['GET /api/subscription/plans'] = [PRO, BASIC, ULTIMATE]
  backend.routes['POST /api/subscription/subscribe'] = envelope({ id: 10, transactionId: 'MOCK_UPGRADE1', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_UPGRADE1', status: 'PENDING' })
  renderBilling()
  const choose = within(await screen.findByRole('region', { name: 'Chọn gói' }, SLOW))
  // Chỉ gói hạng cao hơn, có nút Nâng cấp trực tiếp (không còn Gửi yêu cầu nâng cấp)
  expect(choose.queryByRole('button', { name: /Gửi yêu cầu nâng cấp/ })).toBeNull()
  expect(choose.queryByText('Basic')).toBeNull()
  const upgradeBtn = choose.getByRole('button', { name: 'Nâng cấp lên gói Ultimate' })
  expect(upgradeBtn).toBeInTheDocument()

  await user.click(upgradeBtn)
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent(/đang còn 1 tháng trong gói Pro/i)
  expect(dialog).toHaveTextContent(/số dư credit.*0|reset.*0/i)
  await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục nâng cấp' }))

  expect(await screen.findByText('Đang ở /thanh-toan/ket-qua?ma=MOCK_UPGRADE1&loai=goi', {}, SLOW)).toBeInTheDocument()
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({ body: { planId: 3, gateway: 'MOCK' } })
})

test('renews current plan by year from PlanSummaryCard and allows selecting yearly billing cycle in upgrade dialog', async () => {
  const user = userEvent.setup()
  serve(ACTIVE, 1200)
  const ULTIMATE: PlanDto = { ...BASIC, id: 3, planCode: 'ULTIMATE', name: 'Ultimate', priceVnd: 4990000, tier: 'ULTIMATE', monthlyCredits: null, algorithmTier: 'EP_DBLF_GA_AI' }
  backend.routes['GET /api/subscription/plans'] = [PRO, BASIC, ULTIMATE]
  backend.routes['POST /api/subscription/subscribe'] = envelope({ id: 11, transactionId: 'MOCK_YEARLY1', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_YEARLY1', status: 'PENDING' })
  renderBilling()

  const planRegion = within(await screen.findByRole('region', { name: 'Gói hiện tại' }, SLOW))
  expect(planRegion.getByText('16.390.000 ₫')).toBeInTheDocument()
  const buttons = planRegion.getAllByRole('button').map((b) => b.textContent)
  expect(buttons).toStrictEqual(['Gia hạn thêm một kỳ', 'Gia hạn theo năm', 'Huỷ gói'])

  // 1) Bấm Nâng cấp -> mở dialog có lựa chọn Theo tháng / Theo năm
  const choose = within(screen.getByRole('region', { name: 'Chọn gói' }))
  await user.click(choose.getByRole('button', { name: 'Nâng cấp lên gói Ultimate' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('button', { name: /Theo tháng/i })).toBeInTheDocument()
  const yearlyBtn = within(dialog).getByRole('button', { name: /Theo năm/i })
  await user.click(yearlyBtn)
  expect(dialog).toHaveTextContent('59.880.000 ₫')
  await user.click(within(dialog).getByRole('button', { name: 'Huỷ' }))

  // 2) Bấm Gia hạn theo năm ở thẻ Gói hiện tại -> gửi billingCycle: 'YEARLY' và lưu số tiền vào sessionStorage
  await user.click(planRegion.getByRole('button', { name: 'Gia hạn theo năm' }))
  expect(await screen.findByText('Đang ở /thanh-toan/ket-qua?ma=MOCK_YEARLY1&loai=goi', {}, SLOW)).toBeInTheDocument()
  expect(sessionStorage.getItem('lm_payment_amount_MOCK_YEARLY1')).toBe('16390000')
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({
    body: { planId: 2, billingCycle: 'YEARLY', gateway: 'MOCK' },
  })
})

test('upgrading with yearly cycle selected sends billingCycle YEARLY', async () => {
  const user = userEvent.setup()
  serve(ACTIVE, 1200)
  const ULTIMATE: PlanDto = { ...BASIC, id: 3, planCode: 'ULTIMATE', name: 'Ultimate', priceVnd: 4990000, tier: 'ULTIMATE', monthlyCredits: null, algorithmTier: 'EP_DBLF_GA_AI' }
  backend.routes['GET /api/subscription/plans'] = [PRO, BASIC, ULTIMATE]
  backend.routes['POST /api/subscription/subscribe'] = envelope({ id: 12, transactionId: 'MOCK_UPGRADE_YR', paymentUrl: '/api/payment/mock-checkout?txnRef=MOCK_UPGRADE_YR', status: 'PENDING' })
  renderBilling()

  const choose = within(await screen.findByRole('region', { name: 'Chọn gói' }, SLOW))
  await user.click(choose.getByRole('button', { name: 'Nâng cấp lên gói Ultimate' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: /Theo năm/i }))
  await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục nâng cấp' }))

  expect(await screen.findByText('Đang ở /thanh-toan/ket-qua?ma=MOCK_UPGRADE_YR&loai=goi', {}, SLOW)).toBeInTheDocument()
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({
    body: { planId: 3, billingCycle: 'YEARLY', gateway: 'MOCK' },
  })
})

test('disables renewal buttons when current active plan has already reached 12 months from initial activation', async () => {
  serve({ ...ACTIVE, startedAt: '2026-10-01T08:00:00', expiresAt: '2027-10-01T08:00:00' }, 1200)
  renderBilling()

  const planRegion = within(await screen.findByRole('region', { name: 'Gói hiện tại' }, SLOW))
  expect(planRegion.getByRole('button', { name: 'Gia hạn thêm một kỳ' })).toBeDisabled()
  expect(planRegion.getByRole('button', { name: 'Gia hạn theo năm' })).toBeDisabled()
})

test('a trial company signs its service agreement from the banner', async () => {
  const user = userEvent.setup()
  serve(ACTIVE, 1200)
  const AGREEMENT = {
    id: 5, companyId: 1, companyName: 'Vận tải Long Bình', companyCode: 'LOG-001', taxCode: null, userId: 2, agreementType: 'TRIAL_TERMS',
    agreementCode: 'AGR-5', title: 'Thoả thuận dịch vụ thử nghiệm', content: 'Điều 1. Phạm vi dịch vụ.', status: 'PENDING',
    deadlineAt: '2026-11-04T08:00:00', signedAt: null, signerName: null, signerEmail: null, signerPhone: null, ipAddress: null,
    isExpired: false, hoursRemaining: 40, createdAt: '2026-11-01T01:00:00Z',
  }
  backend.routes['GET /api/agreements/my-agreement'] = envelope(AGREEMENT)
  backend.routes['POST /api/agreements/sign'] = envelope({ ...AGREEMENT, status: 'SIGNED', signerName: 'Nguyễn Văn An', signedAt: '2026-11-02T09:00:00' })
  renderBilling()
  expect(await screen.findByText(/Cần ký thoả thuận dịch vụ thử nghiệm · Còn 40 giờ/, {}, SLOW)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Ký thoả thuận' }))
  const dialog = await screen.findByRole('dialog', { name: 'Thoả thuận dịch vụ thử nghiệm' })
  await user.click(within(dialog).getByRole('button', { name: 'Ký thoả thuận' }))
  expect(within(dialog).getByText('Nhập họ và tên người ký')).toBeInTheDocument()
  expect(within(dialog).getByText('Cần đồng ý với các điều khoản trước khi ký')).toBeInTheDocument()
  await user.type(within(dialog).getByRole('textbox', { name: 'Họ và tên người ký' }), 'Nguyễn Văn An')
  await user.type(within(dialog).getByRole('textbox', { name: 'Số điện thoại' }), '0901234567')
  await user.click(within(dialog).getByRole('checkbox'))
  await user.click(within(dialog).getByRole('button', { name: 'Ký thoả thuận' }))
  await user.click(await screen.findByRole('button', { name: 'Tôi xác nhận ký' }))
  expect(await screen.findByText('Đã ký thoả thuận dịch vụ', {}, SLOW)).toBeInTheDocument()
  expect(backend.calls.find((call) => call.method === 'POST')).toMatchObject({
    url: 'http://be.test/api/agreements/sign',
    body: { signerName: 'Nguyễn Văn An', signerPhone: '0901234567', confirmTerms: true },
  })
})
