import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { PlansPage } from './PlansPage'

/**
 * Danh mục gói của quản lý nền tảng (FE-8-02). Seed: Basic (Phương Nam), Pro (Long Bình) có một công ty dùng, Ultimate không ai dùng;
 * cả ba mang nhãn tạm. Các test dùng chung kho nên chạy theo thứ tự: xem, thêm (bị từ chối), rồi xoá gói không ai dùng.
 */
const SLOW = { timeout: 5000 }

function renderPlans() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('systemManager')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/nen-tang/goi']}>
            <PlansPage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function rowOf(name: string) {
  const table = await screen.findByRole('table', {}, SLOW)
  const row = within(table).getAllByRole('row').find((item) => item.querySelector('td')?.textContent?.startsWith(name))
  if (!row) throw new Error(`Không có dòng của ${name}`)
  return row
}

test('lists the plans with tier, price, credits, algorithm, companies and the provisional tag', async () => {
  renderPlans()
  await screen.findByRole('table', {}, SLOW)
  expect(screen.getByText('3 gói')).toBeInTheDocument()
  const cells = (name: string) => rowOf(name).then((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))
  expect(await cells('Basic')).toStrictEqual(['BasicPLAN-001Giá trị tạm — chờ chốt', 'Basic', '490.000 ₫ / tháng', '100', 'EP + DBLF', '1', '', ''])
  expect(await cells('Pro')).toStrictEqual(['ProPLAN-002Giá trị tạm — chờ chốt', 'Pro', '1.490.000 ₫ / tháng', '500', 'EP + DBLF + GA/SA', '1', '', ''])
  expect(await cells('Ultimate')).toStrictEqual(['UltimatePLAN-003Giá trị tạm — chờ chốt', 'Ultimate', '3.990.000 ₫ / tháng', 'Không giới hạn', 'EP + DBLF + GA/SA', '0', '', ''])
  expect(screen.getAllByRole('switch').map((item) => item.getAttribute('aria-checked'))).toStrictEqual(['true', 'true', 'true'])
})

test('a plan in a tier that already has one on sale is refused with the store message; the dialog stays open', async () => {
  const user = userEvent.setup()
  renderPlans()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Thêm gói' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(/áp dụng từ kỳ gia hạn kế tiếp/)).toBeInTheDocument()
  await user.type(within(dialog).getByRole('textbox', { name: 'Tên gói' }), 'Basic hai')
  await user.type(within(dialog).getByRole('spinbutton', { name: 'Giá mỗi tháng' }), '100000')
  await user.type(within(dialog).getByRole('spinbutton', { name: 'Credit mỗi tháng' }), '10')
  await user.click(within(dialog).getByRole('button', { name: 'Thêm gói' }))
  expect(await screen.findByText(/Hạng này đã có một gói đang bán/, {}, SLOW)).toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText('3 gói')).toBeInTheDocument()
})

test('a plan a company is on cannot be deleted; one nobody uses can', async () => {
  const user = userEvent.setup()
  renderPlans()
  await user.click(await within(await rowOf('Pro')).findByRole('button', { name: 'Thao tác với Pro' }))
  const blocked = await screen.findByRole('menuitem', { name: /Xoá/ })
  expect(blocked).toHaveAttribute('aria-disabled', 'true')
  expect(blocked).toHaveTextContent('Còn 1 công ty đang dùng, ngừng bán thay vì xoá')
  await user.keyboard('{Escape}')

  await user.click(within(await rowOf('Ultimate')).getByRole('button', { name: 'Thao tác với Ultimate' }))
  await user.click(await screen.findByRole('menuitem', { name: /Xoá/ }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xoá gói' }))
  expect(await screen.findByText('Đã xoá gói Ultimate', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('2 gói')).toBeInTheDocument())
})
