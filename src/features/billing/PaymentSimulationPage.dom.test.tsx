import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { PaymentSimulationPage } from './PaymentSimulationPage'

/**
 * Thanh toán giả lập (FE-8-04). Phương Nam (gói Basic, 2 credit) nạp credit; các test dùng chung kho nên chạy theo thứ tự: thành công
 * (cộng một lần), thất bại (số dư không đổi), rồi mã lạ, mã của công ty khác và mã đã xử lý. Việc "xử lý đúng một lần" do kho bảo đảm
 * (`billing.test.ts`); ở đây kiểm trang không làm gì thêm: giao dịch đã xử lý chỉ hiện kết quả.
 */
const SLOW = { timeout: 5000 }
const PHUONG_NAM_ADMIN = 'US-PN-01'

function renderPayment(code: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs(PHUONG_NAM_ADMIN)
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/thanh-toan/gia-lap?giao-dich=${code}`]}>
            <Routes>
              <Route path="/thanh-toan/gia-lap" element={<PaymentSimulationPage />} />
              <Route path="/goi-cuoc" element={<p>Màn gói cước</p>} />
            </Routes>
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

/** Tạo một thanh toán nạp credit chờ trả, như màn gói cước làm. */
async function pendingTopUp(credits: 50 | 500) {
  const db = getMockDb()
  db.restoreSession(PHUONG_NAM_ADMIN)
  return db.topUpCredits(credits)
}

const balance = async () => {
  getMockDb().restoreSession(PHUONG_NAM_ADMIN)
  return (await getMockDb().getCreditBalance()).balance
}

test('success adds the credits once, returns to the billing screen and says what happened', async () => {
  const user = userEvent.setup()
  const { id } = await pendingTopUp(50)
  renderPayment(id)
  await screen.findByText('Nạp 50 credit', {}, SLOW)
  expect(screen.getByText('50.000 ₫')).toBeInTheDocument()
  expect(screen.getByText(id)).toBeInTheDocument()
  expect(screen.getByText(/Đây là trang thanh toán giả lập của bản demo/)).toBeInTheDocument()
  // Không tên, logo hay màu của cổng thanh toán thật: chỉ ba lựa chọn trung tính
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toStrictEqual(['Huỷ', 'Thất bại', 'Thành công'])

  await user.click(screen.getByRole('button', { name: 'Thành công' }))
  expect(await screen.findByText('Đã nạp 50 credit', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('Màn gói cước', {}, SLOW)).toBeInTheDocument()
  expect(await balance()).toBe(52)
})

test('failure and cancel leave the balance as it is and say so', async () => {
  const user = userEvent.setup()
  const { id } = await pendingTopUp(500)
  renderPayment(id)
  await user.click(await screen.findByRole('button', { name: 'Thất bại' }, SLOW))
  expect(await screen.findByText('Thanh toán không thành công, số dư không đổi', {}, SLOW)).toBeInTheDocument()
  expect(await screen.findByText('Màn gói cước', {}, SLOW)).toBeInTheDocument()
  expect(await balance()).toBe(52)
  expect((await getMockDb().getPayment(id)).status).toBe('FAILED')
})

test('an unknown code, a payment of another company and an already settled payment get a proper screen, not a crash', async () => {
  renderPayment('PAY-999')
  expect(await screen.findByText('Không tìm thấy giao dịch', {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thành công' })).toBeNull()

  // PAY-001 là thanh toán đăng ký gói của Long Bình
  renderPayment('PAY-001')
  await screen.findAllByText('Không tìm thấy giao dịch', {}, SLOW)

  // Mở lại giao dịch đã trả: chỉ hiện kết quả, không còn nút, số dư không đổi
  const settled = (await getMockDb().listPayments()).find((payment) => payment.status === 'SUCCESS' && payment.purpose === 'TOPUP')
  renderPayment(settled?.id ?? '')
  const notice = (await screen.findByText('Giao dịch đã được xử lý', {}, SLOW)).parentElement as HTMLElement
  expect(within(notice).getByText(/đã có kết quả: Thành công/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Thành công' })).toBeNull()
  expect(await balance()).toBe(52)
})
