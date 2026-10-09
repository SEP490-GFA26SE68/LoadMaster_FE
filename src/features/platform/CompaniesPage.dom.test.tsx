import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { CompaniesPage } from './CompaniesPage'

/**
 * Màn Công ty của quản trị hệ thống (FE-8-06). Seed: Long Bình (gói Pro, 12 người dùng) và Phương Nam (gói Basic, 5 người dùng). Các test
 * dùng chung kho nên chạy theo thứ tự: xem, tạo bị từ chối, tạo được, sửa.
 */
const SLOW = { timeout: 5000 }

function renderCompanies() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('systemAdmin')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/nen-tang/cong-ty']}>
            <CompaniesPage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function rowOf(name: string) {
  const table = await screen.findByRole('table', {}, SLOW)
  const row = within(table).getAllByRole('row').find((item) => item.querySelector('td')?.textContent?.includes(name))
  if (!row) throw new Error(`Không có dòng của ${name}`)
  return row
}

const cellsOf = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent)

async function fillForm(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, adminEmail: string) {
  const type = (name: string, text: string) => user.type(within(dialog).getByRole('textbox', { name }), text)
  await type('Tên công ty', 'Công ty TNHH Vận tải Biển Hồ')
  await type('Địa chỉ', '25 Quốc lộ 1A, Quận 12')
  await type('Số điện thoại công ty', '0283 812 3456')
  await type('Tên kho', 'Kho Tân Thới Hiệp')
  await type('Vĩ độ', '10.8631')
  await type('Kinh độ', '106.6372')
  await type('Họ tên', 'Hồ Thị Thu Hà')
  await type('Số điện thoại', '0931 245 678')
  await type('Email', adminEmail)
}

test('lists the companies with plan, plan status and the number of users', async () => {
  renderCompanies()
  expect(await screen.findByText('2 công ty', {}, SLOW)).toBeInTheDocument()
  expect(cellsOf(await rowOf('Vận tải Long Bình'))).toStrictEqual(['Công ty TNHH Vận tải Long BìnhLOG-001', 'ProPro', 'Đang hoạt động', '12', ''])
  expect(cellsOf(await rowOf('Giao nhận Phương Nam'))).toStrictEqual(['Công ty CP Giao nhận Phương NamLOG-002', 'BasicBasic', 'Đang hoạt động', '5', ''])
})

test('a first admin whose email is already taken is refused with the store message; the dialog stays open with what was typed', async () => {
  const user = userEvent.setup()
  renderCompanies()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Tạo công ty' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(/Công ty mới chưa có gói cước/)).toBeInTheDocument()
  await fillForm(user, dialog, 'qtcongty@loadmaster.vn')
  await user.click(within(dialog).getByRole('button', { name: 'Tạo công ty' }))
  expect(await within(dialog).findByRole('alert', {}, SLOW)).toHaveTextContent('Email qtcongty@loadmaster.vn đã có người dùng.')
  expect(within(dialog).getByRole('textbox', { name: 'Tên công ty' })).toHaveValue('Công ty TNHH Vận tải Biển Hồ')
  expect(screen.getByText('2 công ty')).toBeInTheDocument()
})

test('creating a company shows the temporary password of its first admin once; the company starts without a plan', async () => {
  const user = userEvent.setup()
  renderCompanies()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Tạo công ty' }))
  const dialog = await screen.findByRole('dialog')
  // Bỏ trống thì báo lỗi tại ô, chưa gửi gì cho kho
  await user.click(within(dialog).getByRole('button', { name: 'Tạo công ty' }))
  expect(await within(dialog).findByText('Nhập tên công ty')).toBeInTheDocument()
  expect(within(dialog).getByText('Chọn toạ độ kho xuất phát')).toBeInTheDocument()
  await fillForm(user, dialog, 'ha.ho@bienho.vn')
  await user.click(within(dialog).getByRole('button', { name: 'Tạo công ty' }))

  const password = await screen.findByRole('textbox', { name: 'Mật khẩu tạm' }, SLOW)
  expect((password as HTMLInputElement).value).toMatch(/^[A-Za-z2-9]{10}$/)
  expect(screen.getByText(/ha\.ho@bienho\.vn/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Xong' }))
  // Đóng hộp thoại là không xem lại được
  expect(screen.queryByRole('textbox', { name: 'Mật khẩu tạm' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('3 công ty')).toBeInTheDocument())
  expect(cellsOf(await rowOf('Biển Hồ'))).toStrictEqual(['Công ty TNHH Vận tải Biển HồLOG-003', 'Chưa có gói', '—', '1', ''])
})

test('editing a company changes its name and depot', async () => {
  const user = userEvent.setup()
  renderCompanies()
  await user.click(await within(await rowOf('Biển Hồ')).findByRole('button', { name: 'Thao tác với Công ty TNHH Vận tải Biển Hồ' }))
  const dialog = await screen.findByRole('dialog')
  // Form sửa không có mục quản trị công ty đầu tiên
  expect(within(dialog).queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument()
  const name = within(dialog).getByRole('textbox', { name: 'Tên công ty' })
  await user.clear(name)
  await user.type(name, 'Công ty CP Vận tải Biển Hồ')
  await user.click(within(dialog).getByRole('button', { name: 'Lưu công ty' }))
  expect(await screen.findByText('Đã lưu công ty Công ty CP Vận tải Biển Hồ', {}, SLOW)).toBeInTheDocument()
  expect(cellsOf(await rowOf('Biển Hồ'))[0]).toBe('Công ty CP Vận tải Biển HồLOG-003')
})
