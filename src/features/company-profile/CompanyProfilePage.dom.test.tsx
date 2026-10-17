import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast, Toaster } from 'sonner'
import { afterEach, expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs, type SeedUserId } from '@/test/signed-in'
import { CompanyProfilePage } from './CompanyProfilePage'

/**
 * Thông tin công ty `/cong-ty` khi chưa nối backend, qua kho dùng chung (độ trễ giả 300 ms). Mỗi bài một công ty hoặc một người để các
 * lần ghi không dính nhau.
 */
const SLOW = { timeout: 4000 }

// Toast còn sống của bài trước được Toaster của bài sau phát lại (sonner phát lại toast đang mở khi đăng ký)
afterEach(() => {
  toast.dismiss()
})

function renderPage(account: SeedUserId) {
  signedInAs(account)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/cong-ty']}>
            <CompanyProfilePage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const factsOf = (identity: HTMLElement) => [...identity.querySelectorAll('dt, dd')].map((cell) => cell.textContent)

test('name, address and phone are editable, code and depot read only; saving updates the store and the company heading', async () => {
  const user = userEvent.setup()
  renderPage('US-LB-01')
  expect(screen.getByRole('heading', { level: 1, name: 'Thông tin công ty' })).toBeInTheDocument()
  const identity = await screen.findByRole('complementary', { name: 'Công ty' }, SLOW)
  expect(within(identity).getByRole('heading', { level: 2, name: 'Công ty TNHH Vận tải Long Bình' })).toBeInTheDocument()
  expect(factsOf(identity)).toStrictEqual(['Mã công ty', 'LOG-001', 'Kho xuất phát', 'Kho Long Bình9 Đường 3A, KCN Biên Hoà 2, Biên Hoà, Đồng Nai'])
  expect(identity).toHaveTextContent('Mã công ty và kho xuất phát do quản trị hệ thống LoadMaster thay đổi.')

  const form = within(screen.getByRole('region', { name: 'Thông tin chung' }))
  expect(form.getByText('Tên, địa chỉ và số điện thoại của công ty.')).toBeInTheDocument()
  const name = form.getByRole('textbox', { name: 'Tên công ty' })
  expect(name).toHaveValue('Công ty TNHH Vận tải Long Bình')
  expect(form.getByRole('textbox', { name: 'Địa chỉ' })).toHaveValue('Kho Long Bình, 9 Đường 3A, KCN Biên Hoà 2, Đồng Nai')
  expect(form.getByRole('textbox', { name: 'Số điện thoại công ty' })).toHaveValue('0251 383 6120')
  expect(form.queryByRole('textbox', { name: 'Email thanh toán' })).not.toBeInTheDocument()

  const save = form.getByRole('button', { name: 'Lưu thay đổi' })
  expect(save).toBeDisabled()
  await user.clear(name)
  await user.type(name, '  QA Vận tải Long Bình ')
  expect(save).toBeEnabled()
  await user.click(save)

  expect(await screen.findByText('Đã lưu thông tin công ty', {}, SLOW)).toBeInTheDocument()
  expect(within(identity).getByRole('heading', { level: 2, name: 'QA Vận tải Long Bình' })).toBeInTheDocument()
  expect(name).toHaveValue('QA Vận tải Long Bình')
  expect(save).toBeDisabled()
  expect(await getMockDb().getCompanyProfile()).toMatchObject({ id: 'LOG-001', name: 'QA Vận tải Long Bình', phone: '0251 383 6120' })
})

test('a blank name and a phone with letters are refused under their fields, and nothing is written', async () => {
  const user = userEvent.setup()
  renderPage('US-PN-01')
  const form = within(await screen.findByRole('region', { name: 'Thông tin chung' }, SLOW))
  await user.clear(form.getByRole('textbox', { name: 'Tên công ty' }))
  const phone = form.getByRole('textbox', { name: 'Số điện thoại công ty' })
  await user.clear(phone)
  await user.type(phone, '0283 hai ba')
  await user.click(form.getByRole('button', { name: 'Lưu thay đổi' }))

  expect(await form.findByText('Nhập tên công ty')).toBeInTheDocument()
  expect(form.getByText('Số điện thoại chỉ gồm chữ số, dấu cách và + - . ( )')).toBeInTheDocument()
  expect(await getMockDb().getCompanyProfile()).toMatchObject({ id: 'LOG-002', name: 'Công ty CP Giao nhận Phương Nam', phone: '0283 773 9054' })
})

test('the store refuses anyone but the company administrator: the reason shows under the form and the typed text stays', async () => {
  const user = userEvent.setup()
  // Quản lý công ty đọc được thông tin công ty (như GET của backend) nhưng không sửa được; route `/cong-ty` vốn chặn họ từ trước
  renderPage('US-0002')
  const form = within(await screen.findByRole('region', { name: 'Thông tin chung' }, SLOW))
  const name = form.getByRole('textbox', { name: 'Tên công ty' })
  await user.clear(name)
  await user.type(name, 'QA Long Bình')
  await user.click(form.getByRole('button', { name: 'Lưu thay đổi' }))

  expect(await form.findByRole('alert', {}, SLOW)).toHaveTextContent('Vai trò của bạn không làm được thao tác này.')
  expect(name).toHaveValue('QA Long Bình')
  expect(form.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled()
  expect(screen.queryByText('Đã lưu thông tin công ty')).not.toBeInTheDocument()
})
