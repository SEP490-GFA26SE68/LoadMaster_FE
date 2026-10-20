import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, MockDbError } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { CONTACT_MIN_FILL_MS } from './contact-form'
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
  // Từ ghép của tiêu đề nối bằng khoảng trắng không ngắt (không xuống dòng giữa "thùng xe"); tên truy cập giữ nguyên ký tự đó
  expect(screen.getByRole('heading', { level: 1, name: 'Tận dụng thùng\u00a0xe, dỡ đúng thứ\u00a0tự, theo\u00a0dõi tới điểm\u00a0giao cuối.' })).toBeInTheDocument()
  const banner = within(screen.getByRole('banner'))
  expect(banner.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/dang-nhap')
  expect(screen.getByRole('link', { name: 'Bỏ qua tới nội dung chính' })).toHaveAttribute('href', '#noi-dung-chinh')
  expect(screen.getByRole('link', { name: 'Nhận tư vấn' })).toHaveAttribute('href', '/gioi-thieu?loai=xem-demo#lien-he')
  expect(screen.getByRole('link', { name: 'Xem bảng giá' })).toHaveAttribute('href', '/bang-gia')
  for (const name of ['Tính năng chính', 'Cách hoạt động', 'Liên hệ với LoadMaster']) {
    expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
  }
  expect(within(screen.getByRole('region', { name: 'Cách hoạt động' })).getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText(/đội LoadMaster sẽ liên hệ lại để tư vấn gói và cách dùng phù hợp với đội xe của bạn\.$/)).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Gửi yêu cầu' }, SLOW)).toBeInTheDocument()
  expect(screen.queryByText(/Đăng ký|Mua gói|Dùng thử/)).not.toBeInTheDocument()
})

test('every number on the page has a source: code constants, the plan catalogue, the seed truck of the axle demo — and no run numbers', async () => {
  renderLanding('/gioi-thieu')
  // jsdom không có WebGL: khung 3D nhường chỗ cho hình minh hoạ, không lần chạy nào nên không số nào của lần chạy
  expect(screen.getByText(/^Hình minh hoạ: thùng xe xếp theo điểm giao/)).toBeInTheDocument()
  // Trang công khai không mang nhãn MOCK RESULT (quyết định của chủ sản phẩm, 20/10/2026), kể cả mục tải trục
  expect(screen.getByRole('region', { name: 'Tải trục trong giới hạn' })).toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()

  const facts = within(screen.getByRole('region', { name: 'Con số kiểm được' }))
  expect(facts.getAllByRole('term').map((term) => term.textContent)).toStrictEqual([
    'phương án cho mỗi lần chạy tối ưu',
    'cho một lần chạy tối ưu 3D',
    'để xếp 1.000 kiện thành đủ ba phương án',
    'luật kiểm trước khi nhận hàng dọc đường',
    'cách đối chiếu một kiện',
    'vai trò trong công ty của bạn',
  ])
  // Mỗi số một câu nguồn: giá trị là định nghĩa thứ nhất của từng cặp
  const values = facts.getAllByRole('definition').filter((_, index) => index % 2 === 0)
  expect(values.map((value) => value.textContent)).toStrictEqual(['3', '1 credit', '< 1 giây', '10', '3', '5'])

  const plans = within(screen.getByRole('region', { name: 'Gói cước' }))
  expect(await plans.findByRole('group', { name: 'Pro' }, SLOW)).toHaveTextContent('500 credit mỗi tháng')
  expect(plans.getByRole('group', { name: 'Ultimate' })).toHaveTextContent('Không giới hạn')
  expect(plans.getByRole('group', { name: 'Basic' })).toHaveTextContent('Giá trị tạm — chờ chốt')
  expect(plans.getByRole('link', { name: 'So sánh các gói' })).toHaveAttribute('href', '/bang-gia')
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
  // Form ghi lúc hiện ra (jsdom: lúc dựng); dời đồng hồ qua thời gian điền tối thiểu để lần gửi không bị chặn
  const realNow = Date.now.bind(Date)
  vi.spyOn(Date, 'now').mockImplementation(() => realNow() + CONTACT_MIN_FILL_MS)
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
  await user.click(screen.getByRole('checkbox', { name: 'Tôi đồng ý để LoadMaster dùng thông tin này để liên hệ tư vấn' }))

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
  expect(sent.closest('[role="status"]')).toHaveTextContent('Bản demo chỉ lưu yêu cầu trong trình duyệt này nên đội LoadMaster chưa nhận được.')

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

test('Lumo speaks with an sr-only "Lumo nói:" prefix, at most once per section, and every Lumo picture is hidden from screen readers', async () => {
  renderLanding('/gioi-thieu')
  expect(await within(screen.getByRole('region', { name: 'Gói cước' })).findByRole('group', { name: 'Pro' }, SLOW)).toBeInTheDocument()
  const lines = [
    ['Con số kiểm được', 'Đây là các con số cố định của chính ứng dụng, không phải số của một chuyến hàng nào.'],
    ['Cách hoạt động', 'Mỗi kiện có nhãn QR riêng, nên lúc soạn, xếp hay dỡ đều đối chiếu được.'],
    ['Gói cước', 'Chưa chắc gói nào hợp? Gửi yêu cầu, đội LoadMaster tư vấn theo đội xe của bạn.'],
    ['Liên hệ với LoadMaster', 'Cần báo giá, xem demo hay hỏi hợp đồng? Chọn ở ô “Bạn cần gì” để đội LoadMaster trả lời đúng việc.'],
  ] as const
  for (const [name, line] of lines) {
    const section = screen.getByRole('region', { name })
    expect(section).toHaveTextContent(`Lumo nói: ${line}`)
    expect(section.querySelectorAll('img[data-lumo]').length).toBeLessThanOrEqual(1)
  }
  const pictures = [...document.querySelectorAll('img[data-lumo]')]
  expect(pictures.length).toBeGreaterThanOrEqual(lines.length)
  for (const picture of pictures) {
    expect(picture).toHaveAttribute('alt', '')
    expect(picture).toHaveAttribute('aria-hidden', 'true')
  }
})

test('the recap ribbon before Gói cước repeats the feature titles for the eye only: hidden from screen readers, no digits', () => {
  renderLanding('/gioi-thieu')
  const features = within(screen.getByRole('region', { name: 'Tính năng chính' }))
  const titles = features.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '').slice(0, 5)
  const ribbon = screen.getByRole('region', { name: 'Gói cước' }).previousElementSibling
  expect(ribbon).toHaveAttribute('aria-hidden', 'true')
  // Hàng trên là đúng năm tiêu đề lợi ích của lưới Tính năng, theo thứ tự của lưới; cả dải không có chữ số nào
  const rows = [...(ribbon?.querySelectorAll('.reveal-ribbon-track') ?? [])]
  expect(rows).toHaveLength(2)
  const top = [...(rows[0]?.querySelectorAll('.reveal-ribbon-item') ?? [])].map((item) => item.textContent).slice(0, titles.length)
  expect(top).toStrictEqual(titles)
  expect(ribbon?.textContent).not.toMatch(/\d/)
})
