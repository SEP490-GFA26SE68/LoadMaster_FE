import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { envelope, useFakeBackend } from '@/test/billing-backend-fetch'
import { PaymentResultPage } from './PaymentResultPage'

/**
 * Trang xác nhận thanh toán khi nối backend: xác nhận gọi cổng thử rồi đọc lại kết quả; thành công về gói cước kèm toast nói đúng điều
 * backend ghi, chưa ghi nhận thì nói tại chỗ kèm mã cổng.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

const backend = useFakeBackend()
const SLOW = { timeout: 5000 }
const checkout = (code: string) => ({ success: true, message: 'Mock payment executed successfully', txnRef: 'MOCK_A1', callbackResult: { RspCode: code, Message: 'x' } })

afterEach(() => {
  vi.useRealTimers()
})

function renderResult(search: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/thanh-toan/ket-qua${search}`]}>
          <Routes>
            <Route path="/thanh-toan/ket-qua" element={<PaymentResultPage />} />
            <Route path="/goi-cuoc" element={<p>Màn gói cước</p>} />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('a top-up confirmed by the gateway and found in the ledger: back to the plan with the credits the backend added', async () => {
  const user = userEvent.setup()
  backend.routes['GET /api/payment/mock-checkout?txnRef=MOCK_A1'] = checkout('00')
  backend.routes['GET /api/credits/transactions?page=0&size=50'] = envelope({
    content: [{ id: 9, amount: 50, type: 'PURCHASE', reference: 'MOCK_A1', refunded: false, createdAt: '2026-10-17T10:00:00' }],
    last: true,
  })
  renderResult('?ma=MOCK_A1&loai=credit')
  expect(screen.getByText('Nạp credit')).toBeInTheDocument()
  expect(screen.getByText('MOCK_A1')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }))
  expect(await screen.findByText('Màn gói cước', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('Đã nạp 50 credit')).toBeInTheDocument()
})

test('a subscription the gateway rejects (bad signature): stays, says the server has not recorded it, with the gateway code', async () => {
  const user = userEvent.setup()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-17T03:00:00Z'))
  backend.routes['GET /api/payment/mock-checkout?txnRef=VNPAY_B2'] = checkout('97')
  backend.routes['GET /api/subscription/current'] = envelope({
    subscriptionId: 1, planId: 2, planName: 'Pro', tier: 'PRO', status: 'ACTIVE', startedAt: '2026-10-01T08:00:00', expiresAt: '2026-11-01T08:00:00',
    autoRenew: true, creditsBalance: 0, creditsMonthlyGrant: 500, algorithmTier: 'EP_DBLF_GA',
  })
  renderResult('?ma=VNPAY_B2&loai=goi')
  await user.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }))
  expect(await screen.findByText('Máy chủ chưa ghi nhận thanh toán này (mã cổng 97). Gói và số dư không đổi.', {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Xác nhận thanh toán' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Về gói cước' }))
  expect(await screen.findByText('Màn gói cước')).toBeInTheDocument()
})

test('cancelling pays nothing and calls nothing', async () => {
  const user = userEvent.setup()
  renderResult('?ma=MOCK_A1&loai=goi')
  await user.click(screen.getByRole('button', { name: 'Huỷ' }))
  expect(await screen.findByText('Chưa thanh toán — gói và số dư không đổi')).toBeInTheDocument()
  expect(backend.calls).toHaveLength(0)
})

test('a link without a known type shows not found', () => {
  renderResult('?ma=MOCK_A1&loai=khac')
  expect(screen.getByText('Không tìm thấy giao dịch')).toBeInTheDocument()
  expect(screen.getByText('Đường dẫn thiếu mã giao dịch hoặc loại thanh toán.')).toBeInTheDocument()
})
