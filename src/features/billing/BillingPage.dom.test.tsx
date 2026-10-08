import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { BillingPage } from './BillingPage'

/**
 * Gói cước và credit của công ty (FE-8-03). Seed: Long Bình gói Pro, 486 credit, 17 giao dịch credit và một thanh toán đã trả; Phương Nam
 * gói Basic, 2 credit. Các test dùng chung kho nên chạy theo thứ tự: xem, nạp, gói không giới hạn, rồi các việc đổi trạng thái gói
 * (đồng hồ của kho là `Date`, giả `Date` để gói tới hạn mà không chờ).
 */
const SLOW = { timeout: 5000 }
const DAY_MS = 24 * 60 * 60 * 1000
const LONG_BINH_ADMIN = 'US-LB-01'
const PHUONG_NAM_ADMIN = 'US-PN-01'
const PLATFORM_MANAGER = 'US-NT-01'

/** Đích của nút đưa sang thanh toán: trang này chỉ cần biết đã mở đúng đường dẫn. */
function PaymentProbe() {
  return <p>Đang ở {useLocation().search}</p>
}

function renderBilling(account: typeof LONG_BINH_ADMIN | typeof PHUONG_NAM_ADMIN) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs(account)
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/goi-cuoc']}>
            <Routes>
              <Route path="/goi-cuoc" element={<BillingPage />} />
              <Route path="/thanh-toan/gia-lap" element={<PaymentProbe />} />
            </Routes>
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
})

const regionOf = (name: string) => within(screen.getByRole('region', { name }))
const rowsOf = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)

test('shows the plan, the balance and both histories of the company', async () => {
  const user = userEvent.setup()
  renderBilling(LONG_BINH_ADMIN)
  await screen.findByRole('region', { name: 'Gói hiện tại' }, SLOW)
  const plan = regionOf('Gói hiện tại')
  // Tên gói và nhãn hạng cùng ghi "Pro"
  expect(plan.getAllByText('Pro')).toHaveLength(2)
  for (const text of ['Giá trị tạm — chờ chốt', 'Đang hoạt động', '1.490.000 ₫', '500']) expect(plan.getByText(text)).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Số dư' })).getByText('486')).toBeInTheDocument()
  // Đang có gói còn hiệu lực: không có danh sách chọn gói
  expect(screen.queryByRole('region', { name: 'Chọn gói' })).toBeNull()

  // Lịch sử credit: một lần cấp tháng, 15 lượt dùng, một lần hoàn
  await waitFor(() => expect(rowsOf()).toHaveLength(17), SLOW)
  const types = rowsOf().map((row) => within(row).getAllByRole('cell')[1]?.textContent)
  expect(types.filter((type) => type === 'Cấp theo tháng')).toHaveLength(1)
  expect(types.filter((type) => type === 'Dùng')).toHaveLength(15)
  expect(types.filter((type) => type === 'Hoàn')).toHaveLength(1)

  await user.click(screen.getByRole('tab', { name: /Thanh toán/ }))
  await waitFor(() => expect(rowsOf()).toHaveLength(1))
  expect(within(rowsOf()[0] as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent))
    .toStrictEqual([expect.stringContaining('/'), 'PAY-001', 'Đăng ký gói', '1.490.000 ₫', 'Thành công', ''])
})

test('topping up creates a pending payment and opens the simulated payment page', async () => {
  const user = userEvent.setup()
  renderBilling(PHUONG_NAM_ADMIN)
  await user.click(await screen.findByRole('button', { name: 'Nạp credit' }, SLOW))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getAllByRole('radio').map((radio) => radio.closest('div')?.textContent)).toStrictEqual(['50 credit50.000 ₫', '500 credit500.000 ₫'])
  await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' }))
  expect(await screen.findByText(/Đang ở \?giao-dich=PAY-\d+/, {}, SLOW)).toBeInTheDocument()

  const [payment] = await getMockDb().listPayments()
  expect(payment).toMatchObject({ purpose: 'TOPUP', amountVnd: 50_000, credits: 50, status: 'PENDING' })
  // Chưa trả thì số dư chưa đổi
  expect((await getMockDb().getCreditBalance()).balance).toBe(2)
})

test('an unlimited plan shows "Không giới hạn" instead of a balance', async () => {
  const db = getMockDb()
  db.restoreSession(PLATFORM_MANAGER)
  await db.updateSubscriptionPlan('PLAN-001', { monthlyCredits: null })
  renderBilling(PHUONG_NAM_ADMIN)
  await screen.findByRole('region', { name: 'Gói hiện tại' }, SLOW)
  expect(within(screen.getByRole('group', { name: 'Số dư' })).getByText('Không giới hạn')).toBeInTheDocument()
  expect(regionOf('Gói hiện tại').getByText('Không giới hạn')).toBeInTheDocument()
})

test('a renewal payment waiting to be paid has a banner with Pay; cancelling keeps the plan until the end of the period', async () => {
  const user = userEvent.setup()
  const db = getMockDb()
  db.restoreSession(LONG_BINH_ADMIN)
  const expiresAt = (await db.getCurrentSubscription())?.subscription.expiresAt ?? ''
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.parse(expiresAt) - 2 * DAY_MS)
  renderBilling(LONG_BINH_ADMIN)

  // Lúc đang tải màn cũng có một vùng `status` (vòng xoay): tìm dải thông báo theo chữ của nó, không theo vai trò
  const banner = await waitFor(() => {
    const found = screen.getAllByRole('status').find((el) => el.textContent?.startsWith('Thanh toán gia hạn gói Pro'))
    if (!found) throw new Error('chưa thấy dải thông báo gia hạn')
    return found
  }, SLOW)
  expect(banner).toHaveTextContent('Thanh toán gia hạn gói Pro (1.490.000 ₫) đang chờ')
  expect(within(banner).getByRole('link', { name: 'Trả' })).toHaveAttribute('href', expect.stringMatching(/^\/thanh-toan\/gia-lap\?giao-dich=PAY-\d+$/))

  await user.click(regionOf('Gói hiện tại').getByRole('button', { name: 'Huỷ gói' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('Gói vẫn dùng được tới hết')
  await user.click(within(dialog).getByRole('button', { name: 'Huỷ gói' }))
  expect(await screen.findByText(/Đã huỷ gói Pro\. Gói dùng được tới hết/, {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(regionOf('Gói hiện tại').getByText('Đã huỷ — còn hiệu lực')).toBeInTheDocument(), SLOW)
  expect(regionOf('Gói hiện tại').queryByRole('button', { name: 'Huỷ gói' })).toBeNull()
  // Huỷ gói thì thanh toán gia hạn đang chờ không còn
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Trả' })).toBeNull())
})

test('an expired plan offers the plans on sale; subscribing creates a pending payment and opens the payment page', async () => {
  const user = userEvent.setup()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 90 * DAY_MS)
  renderBilling(PHUONG_NAM_ADMIN)

  await screen.findByRole('region', { name: 'Gói hiện tại' }, SLOW)
  expect(regionOf('Gói hiện tại').getByText('Đã hết hạn')).toBeInTheDocument()
  const choose = await screen.findByRole('region', { name: 'Chọn gói' }, SLOW)
  expect(within(choose).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toStrictEqual(['Đăng ký gói Basic', 'Đăng ký gói Pro', 'Đăng ký gói Ultimate'])
  await user.click(within(choose).getByRole('button', { name: 'Đăng ký gói Pro' }))
  expect(await screen.findByText(/Đang ở \?giao-dich=PAY-\d+/, {}, SLOW)).toBeInTheDocument()
  expect((await getMockDb().listPayments())[0]).toMatchObject({ purpose: 'SUBSCRIBE', planId: 'PLAN-002', amountVnd: 1_490_000, status: 'PENDING' })
})
