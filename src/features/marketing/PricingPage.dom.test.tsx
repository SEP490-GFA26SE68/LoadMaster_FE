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

test('only the plans on sale are listed, each with a quiet provisional tag, price, credits, tier in plain words, its own extras and a contact link', async () => {
  const db = getMockDb()
  db.restoreSession('US-NT-01')
  await db.setSubscriptionPlanActive('PLAN-001', false)
  db.restoreSession(null)
  renderPricing()

  expect(screen.getByRole('heading', { level: 1, name: 'Bảng giá' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Đang tải bảng giá' })).toBeInTheDocument()
  await screen.findByRole('heading', { level: 2, name: 'Pro' }, SLOW)
  expect(within(screen.getByRole('main')).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toStrictEqual([
    'Pro', 'Ultimate', 'Mọi gói đều có', 'Credit tính thế nào', 'Trước khi chọn gói',
  ])

  const pro = screen.getByRole('group', { name: 'Pro' })
  expect(within(pro).getByText('Giá trị tạm — chờ chốt')).toBeInTheDocument()
  expect(pro).toHaveTextContent(/1\.490\.000\s₫\s*\/ tháng/)
  expect(within(pro).getByText('Credit mỗi tháng').nextElementSibling).toHaveTextContent('500')
  expect(within(pro).getByText('Hạng thuật toán').nextElementSibling).toHaveTextContent('Nâng cao')
  // Pro và Ultimate cùng có ba tính năng: chúng nằm ở "Mọi gói đều có", thẻ chỉ còn phần riêng
  expect(within(screen.getByRole('region', { name: 'Mọi gói đều có' })).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Tối ưu xếp hàng 3D, ba phương án mỗi lần chạy', 'Tối ưu tuyến giao hàng', 'Hạng thuật toán nâng cao',
  ])
  expect(within(pro).queryAllByRole('listitem')).toHaveLength(0)
  expect(pro).toHaveTextContent('Gồm đủ phần chung của mọi gói.')
  // Tên truy cập bắt đầu bằng đúng chữ hiện ra, tên gói chỉ cho trình đọc màn hình
  const contact = within(pro).getByRole('link', { name: 'Liên hệ tư vấn gói Pro' })
  expect(contact).toHaveAttribute('href', '/gioi-thieu?goi=PLAN-002&loai=bao-gia#lien-he')
  expect(contact).not.toHaveAttribute('aria-label')

  const ultimate = screen.getByRole('group', { name: 'Ultimate' })
  expect(within(ultimate).getByText('Credit mỗi tháng').nextElementSibling).toHaveTextContent('Không giới hạn')
  expect(within(ultimate).getByText('Hạng thuật toán').nextElementSibling).toHaveTextContent('Nâng cao')
  expect(within(ultimate).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual(['Không giới hạn số lần chạy tối ưu'])

  // Credit: số lấy từ code — một credit một lần chạy, ba phương án, tối ưu tuyến không tốn
  expect(within(screen.getByRole('region', { name: 'Credit tính thế nào' })).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    '1 credit cho một lần chạy tối ưu xếp hàng 3D.',
    'Mỗi lần chạy ra 3 phương án để so sánh — vẫn tính là một lần.',
    'Tối ưu tuyến giao hàng không tốn credit.',
  ])

  // Lời của khách: không tên thuật toán, không "mock"
  expect(document.body).not.toHaveTextContent(/EP \+ DBLF|GA\/SA|mock|AI Optimizer/)
  // Một lưu ý chung: hạng ghi trên thẻ là của bản chạy chính thức, bản demo tối ưu một hạng cho mọi gói; một câu về giá tạm cho mọi thẻ
  const notes = within(screen.getByRole('region', { name: 'Trước khi chọn gói' }))
  expect(notes.getByText(/^Hạng thuật toán là mức tối ưu gói được dùng khi LoadMaster chạy chính thức. Bản demo đang mở tối ưu ở hạng Cơ bản cho mọi gói/)).toBeInTheDocument()
  expect(notes.getByText('Giá và credit của gói gắn nhãn “Giá trị tạm — chờ chốt” chưa chốt, có thể đổi trước khi dịch vụ chạy chính thức.')).toBeInTheDocument()

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

test('with every tier on sale the shared part is 3D and route optimization, each card lists only what it adds', async () => {
  const plans = await getMockDb().listSubscriptionPlans()
  vi.spyOn(getMockDb(), 'listSubscriptionPlans').mockResolvedValueOnce(plans.map((plan) => ({ ...plan, active: true })))
  renderPricing()
  await screen.findByRole('group', { name: 'Basic' }, SLOW)
  expect(within(screen.getByRole('region', { name: 'Mọi gói đều có' })).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Tối ưu xếp hàng 3D, ba phương án mỗi lần chạy', 'Tối ưu tuyến giao hàng',
  ])
  expect(screen.getByRole('group', { name: 'Basic' })).toHaveTextContent('Gồm đủ phần chung của mọi gói.')
  expect(within(screen.getByRole('group', { name: 'Pro' })).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual(['Hạng thuật toán nâng cao'])
  expect(within(screen.getByRole('group', { name: 'Ultimate' })).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual([
    'Hạng thuật toán nâng cao', 'Không giới hạn số lần chạy tối ưu',
  ])
})

test('when no plan carries the provisional flag there is no tag and no shared provisional note', async () => {
  const plans = await getMockDb().listSubscriptionPlans()
  vi.spyOn(getMockDb(), 'listSubscriptionPlans').mockResolvedValueOnce(plans.map((plan) => ({ ...plan, provisional: false })))
  renderPricing()
  await screen.findByRole('group', { name: 'Pro' }, SLOW)
  expect(screen.queryByText(/Giá trị tạm — chờ chốt/)).not.toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Trước khi chọn gói' })).getAllByRole('listitem')).toHaveLength(2)
})
