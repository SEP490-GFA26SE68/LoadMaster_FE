import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, MockDbError } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { LandingPage } from './LandingPage'

/**
 * Trang giới thiệu công khai và form liên hệ của khách. Seed có LH-001 → LH-003 nên yêu cầu mới là LH-004. Các test dùng chung kho của
 * app nên chạy theo thứ tự.
 */
const SLOW = { timeout: 5000 }

/** Hình thùng xe đọc `prefers-reduced-motion`; jsdom chưa có `matchMedia`. */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

function Where() {
  const location = useLocation()
  return <p>Đang ở {location.pathname + location.search}</p>
}

function renderLanding(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/gioi-thieu" element={<LandingPage />} />
              <Route path="*" element={<Where />} />
            </Routes>
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

test('a guest sees what the app does and how to get in touch: sign-in in the header, no sign-up or purchase', async () => {
  renderLanding('/gioi-thieu')
  expect(screen.getByRole('heading', { level: 1, name: 'Tận dụng thùng xe, dỡ đúng thứ tự, theo dõi tới điểm giao cuối.' })).toBeInTheDocument()
  const banner = within(screen.getByRole('banner'))
  expect(banner.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/dang-nhap')
  expect(screen.getByRole('link', { name: 'Bỏ qua tới nội dung chính' })).toHaveAttribute('href', '#noi-dung-chinh')
  expect(screen.getByRole('link', { name: 'Nhận tư vấn' })).toHaveAttribute('href', '/gioi-thieu#lien-he')
  expect(screen.getByRole('link', { name: 'Xem bảng giá' })).toHaveAttribute('href', '/bang-gia')
  for (const name of ['Tính năng chính', 'Cách hoạt động', 'Liên hệ với LoadMaster']) {
    expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
  }
  expect(within(screen.getByRole('region', { name: 'Cách hoạt động' })).getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText(/đội LoadMaster sẽ liên hệ lại để tư vấn gói và cách dùng phù hợp với đội xe của bạn\.$/)).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Gửi yêu cầu' }, SLOW)).toBeInTheDocument()
  expect(screen.queryByText(/Đăng ký|Mua gói|Dùng thử/)).not.toBeInTheDocument()
})

test('the skip link moves focus to the main content without changing the address', async () => {
  const user = userEvent.setup()
  renderLanding('/gioi-thieu')
  await user.click(screen.getByRole('link', { name: 'Bỏ qua tới nội dung chính' }))
  expect(screen.getByRole('main')).toHaveFocus()
  expect(screen.queryByText(/Đang ở/)).not.toBeInTheDocument()
})

test('the header menu lists the four sections; picking one moves focus to that section, not back to the menu button', async () => {
  const user = userEvent.setup()
  renderLanding('/gioi-thieu')
  await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Menu trang' }))
  const items = screen.getAllByRole('menuitem')
  expect(items.map((item) => [item.textContent, item.getAttribute('href')])).toStrictEqual([
    ['Tính năng', '/gioi-thieu#tinh-nang'],
    ['Cách hoạt động', '/gioi-thieu#cach-hoat-dong'],
    ['Bảng giá', '/bang-gia'],
    ['Liên hệ', '/gioi-thieu#lien-he'],
  ])
  await user.click(screen.getByRole('menuitem', { name: 'Liên hệ' }))
  const heading = screen.getByRole('heading', { level: 2, name: 'Liên hệ với LoadMaster' })
  await waitFor(() => expect(heading).toHaveFocus())
  // Menu trả focus về nút của nó sau một nhịp: không được cướp lại focus của tiêu đề
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(heading).toHaveFocus()
})

test('a malformed anchor (#%) does not break the page', () => {
  renderLanding('/gioi-thieu#%')
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
})

test('the contact form needs a name and a valid email, keeps the input when sending fails, then sends a NEW request', async () => {
  const user = userEvent.setup()
  renderLanding('/gioi-thieu?goi=PLAN-002&loai=bao-gia#lien-he')
  // Tới qua neo: tiêu đề của phần nhận focus
  expect(screen.getByRole('heading', { level: 2, name: 'Liên hệ với LoadMaster' })).toHaveFocus()
  const submit = await screen.findByRole('button', { name: 'Gửi yêu cầu' }, SLOW)
  expect(screen.getByRole('combobox', { name: 'Bạn cần gì' })).toHaveTextContent('Báo giá')
  expect(screen.getByRole('combobox', { name: 'Gói quan tâm' })).toHaveTextContent('Pro')

  await user.click(submit)
  const name = screen.getByRole('textbox', { name: 'Họ tên' })
  const email = screen.getByRole('textbox', { name: 'Email' })
  expect(await screen.findByText('Nhập họ tên')).toBeInTheDocument()
  expect(screen.getByText('Nhập email')).toBeInTheDocument()
  expect(name).toHaveAttribute('aria-invalid', 'true')

  await user.type(name, 'Trần Minh Quân')
  await user.type(email, 'quan@')
  await user.click(submit)
  expect(await screen.findByText('Email không đúng định dạng')).toBeInTheDocument()

  await user.clear(email)
  await user.type(email, 'quan@vantaiminhquan.vn')
  await user.type(screen.getByRole('textbox', { name: 'Tên công ty' }), 'Vận tải Minh Quân')
  await user.type(screen.getByRole('textbox', { name: 'Nội dung' }), 'Đội 12 xe tải, cần báo giá gói Pro.')

  // Kho từ chối: banner nói mục nào, dữ liệu đang nhập giữ nguyên
  vi.spyOn(getMockDb(), 'createGuestContact').mockRejectedValueOnce(new MockDbError('CONTACT_INVALID', { field: 'email' }))
  await user.click(submit)
  const refused = await screen.findByText('Mục "Email" của yêu cầu liên hệ chưa hợp lệ. Kiểm tra lại mục đó rồi thử lại.')
  expect(refused.closest('[role="alert"]')).not.toBeNull()
  expect(name).toHaveValue('Trần Minh Quân')
  expect(email).toHaveValue('quan@vantaiminhquan.vn')

  await user.click(submit)
  const sent = await screen.findByRole('heading', { name: 'Đã ghi nhận yêu cầu LH-004' }, SLOW)
  expect(sent).toHaveFocus()
  expect(sent.closest('[role="status"]')).toHaveTextContent('Đội LoadMaster sẽ liên hệ lại qua email bạn đã nhập.')

  // Gửi yêu cầu khác: form trống, con trỏ ở ô Họ tên, vẫn chọn sẵn như lúc mở trang
  await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu khác' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Họ tên' })).toHaveFocus())
  expect(screen.getByRole('textbox', { name: 'Họ tên' })).toHaveValue('')
  expect(screen.getByRole('combobox', { name: 'Gói quan tâm' })).toHaveTextContent('Pro')

  const db = getMockDb()
  db.restoreSession('US-NT-02')
  expect(await db.getGuestContact('LH-004')).toMatchObject({
    fullName: 'Trần Minh Quân',
    email: 'quan@vantaiminhquan.vn',
    companyName: 'Vận tải Minh Quân',
    message: 'Đội 12 xe tải, cần báo giá gói Pro.',
    requestType: 'PRICING',
    interestedPlanId: 'PLAN-002',
    status: 'NEW',
  })
  expect(await db.getGuestContact('LH-004')).not.toHaveProperty('phoneNumber')
  db.restoreSession(null)
})

test('a signed-in company admin is offered the app, not the sign-in screen', async () => {
  signedInAs('companyAdmin')
  renderLanding('/gioi-thieu')
  expect(await within(screen.getByRole('banner')).findByRole('link', { name: 'Vào ứng dụng' })).toHaveAttribute('href', '/nguoi-dung')
})
