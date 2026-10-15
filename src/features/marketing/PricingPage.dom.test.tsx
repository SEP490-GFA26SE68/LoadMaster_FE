import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { PricingPage } from './PricingPage'

/**
 * Bảng giá công khai. Seed: Basic, Pro, Ultimate đều đang bán và mang cờ giá tạm; test đầu cho Basic ngừng bán (như Quản lý nền tảng làm
 * ở màn Danh mục gói) nên bảng giá chỉ còn hai gói. Các test dùng chung kho của app nên chạy theo thứ tự.
 */
const SLOW = { timeout: 5000 }

function renderPricing() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/bang-gia']}>
            <PricingPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

test('only the plans on sale are listed, each with its provisional tag, price, credits, tier in plain words and a contact link', async () => {
  const db = getMockDb()
  db.restoreSession('US-NT-01')
  await db.setSubscriptionPlanActive('PLAN-001', false)
  db.restoreSession(null)
  renderPricing()

  expect(screen.getByRole('heading', { level: 1, name: 'Bảng giá' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Đang tải bảng giá' })).toBeInTheDocument()
  await screen.findByRole('heading', { level: 2, name: 'Pro' }, SLOW)
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual(['Pro', 'Ultimate'])

  const pro = screen.getByRole('group', { name: 'Pro' })
  expect(within(pro).getByText('Giá trị tạm — chờ chốt')).toBeInTheDocument()
  expect(pro).toHaveTextContent(/1\.490\.000\s₫\s*\/ tháng/)
  expect(within(pro).getByText('Credit mỗi tháng').nextElementSibling).toHaveTextContent('500')
  expect(within(pro).getByText('Hạng thuật toán').nextElementSibling).toHaveTextContent('Nâng cao')
  expect(within(pro).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Tối ưu xếp hàng 3D, ba phương án mỗi lần chạy', 'Tối ưu tuyến giao hàng', 'Hạng thuật toán nâng cao',
  ])
  // Tên truy cập bắt đầu bằng đúng chữ hiện ra, tên gói chỉ cho trình đọc màn hình
  const contact = within(pro).getByRole('link', { name: 'Liên hệ tư vấn gói Pro' })
  expect(contact).toHaveAttribute('href', '/gioi-thieu?goi=PLAN-002&loai=bao-gia#lien-he')
  expect(contact).not.toHaveAttribute('aria-label')

  const ultimate = screen.getByRole('group', { name: 'Ultimate' })
  expect(within(ultimate).getByText('Credit mỗi tháng').nextElementSibling).toHaveTextContent('Không giới hạn')
  expect(within(ultimate).getByText('Hạng thuật toán').nextElementSibling).toHaveTextContent('Nâng cao')

  // Lời của khách: không tên thuật toán, không "mock"
  expect(document.body).not.toHaveTextContent(/EP \+ DBLF|GA\/SA|mock|AI Optimizer/)
  expect(screen.getByText('Bản demo hiện tối ưu ở hạng Cơ bản cho mọi gói.')).toBeInTheDocument()

  // Không đăng ký, không mua: nút chính là "Nhận tư vấn"; khách không có lối vào màn gói của công ty
  expect(screen.getByRole('link', { name: 'Nhận tư vấn' })).toHaveAttribute('href', '/gioi-thieu?loai=bao-gia#lien-he')
  expect(screen.queryByRole('link', { name: 'Quản lý gói của công ty' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Đăng ký|Mua gói/)).not.toBeInTheDocument()
})

test('a plan whose price is settled carries no provisional tag', async () => {
  const plans = await getMockDb().listSubscriptionPlans()
  vi.spyOn(getMockDb(), 'listSubscriptionPlans').mockResolvedValueOnce(
    plans.map((plan) => (plan.id === 'PLAN-002' ? { ...plan, provisional: false } : plan)),
  )
  renderPricing()
  const pro = await screen.findByRole('group', { name: 'Pro' }, SLOW)
  expect(within(pro).queryByText('Giá trị tạm — chờ chốt')).not.toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Ultimate' })).getByText('Giá trị tạm — chờ chốt')).toBeInTheDocument()
})

test('a failed load says so and offers to try again', async () => {
  const user = userEvent.setup()
  vi.spyOn(getMockDb(), 'listSubscriptionPlans').mockRejectedValueOnce(new Error('mất mạng'))
  renderPricing()
  expect(await screen.findByText('Không tải được bảng giá.', {}, SLOW)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await screen.findByRole('group', { name: 'Pro' }, SLOW)).toBeInTheDocument()
})

test('with no plan on sale the page says so instead of showing an empty grid', async () => {
  vi.spyOn(getMockDb(), 'listSubscriptionPlans').mockResolvedValueOnce([])
  renderPricing()
  expect(await screen.findByText('Hiện chưa có gói nào đang bán.', {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: /^(Basic|Pro|Ultimate)$/ })).not.toBeInTheDocument()
})

test('a signed-in company admin also gets a way to the company plan screen', async () => {
  signedInAs('companyAdmin')
  renderPricing()
  expect(await screen.findByRole('link', { name: 'Quản lý gói của công ty' }, SLOW)).toHaveAttribute('href', '/goi-cuoc')
})
