import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, MockDbError } from '@/lib/mock-db'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { signedInAs } from '@/test/signed-in'
import { LandingPage } from './LandingPage'

/**
 * Trang giới thiệu công khai và form liên hệ của khách. Seed có LH-001 → LH-003 nên yêu cầu mới là LH-004. Các test dùng chung kho của
 * app nên chạy theo thứ tự.
 */
const SLOW = { timeout: 5000 }
/** Tiêu đề năm chặng của "Một chuyến hàng trên LoadMaster", theo thứ tự. */
const CHAPTER_TITLES = ['Lập chuyến và chọn phương án', 'Soạn và xếp ở kho', 'Trên đường', 'Tại điểm giao', 'Giao xong, báo cáo và tính lương']

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

let io: FakeIntersectionObserverControl | null = null
let media: MatchMediaControl | null = null

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  // Gỡ cây React trước, để effect dọn observer và người nghe `matchMedia` trên chính bản giả, rồi mới trả lại bản giả
  cleanup()
  io?.restore()
  media?.restore()
  io = null
  media = null
  sessionStorage.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** Form liên hệ chỉ gửi khi đã hiện ít nhất 3 giây: test giả `Date` từ lúc mở trang rồi tua đồng hồ, `setTimeout` vẫn chạy thật. */
function fakeClock() {
  vi.useFakeTimers({ toFake: ['Date'] })
  return { wait: (ms: number) => vi.setSystemTime(Date.now() + ms) }
}

const BLOCKED = 'Chưa gửi được: lần gửi này trông như của chương trình tự động. Bạn kiểm lại các ô rồi bấm "Gửi yêu cầu" lần nữa.'
const CONSENT = /^Tôi đã đọc và đồng ý với chính sách bảo mật/

test('a guest sees what the app does and how to get in touch: sign-in in the header, no sign-up or purchase', async () => {
  renderLanding('/gioi-thieu')
  expect(screen.getByRole('heading', { level: 1, name: 'Tới điểm nào, mở cửa là thấy hàng của điểm đó.' })).toBeInTheDocument()
  const banner = within(screen.getByRole('banner'))
  expect(banner.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/dang-nhap')
  expect(screen.getByRole('link', { name: 'Bỏ qua tới nội dung chính' })).toHaveAttribute('href', '#noi-dung-chinh')
  expect(screen.getByRole('link', { name: 'Nhận tư vấn' })).toHaveAttribute('href', '/gioi-thieu#lien-he')
  expect(screen.getByRole('link', { name: 'Xem bảng giá' })).toHaveAttribute('href', '/bang-gia')
  for (const name of ['Ba chuyện quen thuộc của một chuyến hàng', 'Một chuyến hàng trên LoadMaster', 'Hỏi đáp', 'Liên hệ với LoadMaster']) {
    expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
  }
  // Năm chặng của một chuyến, theo thứ tự, mỗi chặng một tiêu đề
  const journey = within(screen.getByRole('list', { name: 'Năm chặng của một chuyến hàng' }))
  expect(journey.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toStrictEqual(CHAPTER_TITLES)
  expect(screen.getByText(/đội LoadMaster sẽ liên hệ lại để tư vấn gói và cách dùng phù hợp với đội xe của bạn\.$/)).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Gửi yêu cầu' }, SLOW)).toBeInTheDocument()
  // Kho mẫu không có đăng ký hay mua gói ngay trên trang (hai luồng đăng ký chỉ có khi nối backend): tài khoản dùng thử mở qua yêu cầu liên hệ
  expect(screen.queryByRole('link', { name: /Đăng ký|Mua gói|Dùng thử/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Đăng ký|Mua gói|Dùng thử/ })).not.toBeInTheDocument()
})

test('every number on the page has a source: code constants, the plan catalogue — and no run, no result numbers', async () => {
  renderLanding('/gioi-thieu')
  // jsdom không có WebGL: khung 3D nhường chỗ cho hình minh hoạ, không lần chạy nào nên không số nào của lần chạy
  expect(screen.getByText(/^Hình minh hoạ: hàng của điểm giao cuối nằm sâu nhất/)).toBeInTheDocument()
  // Trang công khai không có nhãn MOCK RESULT ở đâu cả: mỗi số tự mang câu nguồn của nó
  expect(screen.queryByText(/MOCK/)).not.toBeInTheDocument()

  // Bảng ba phương án: jsdom không có Web Worker nên lần chạy mẫu không chạy — bảng không có số nào, một câu nói vì sao
  const journey = within(screen.getByRole('region', { name: 'Một chuyến hàng trên LoadMaster' }))
  const table = journey.getByRole('table', { name: 'So sánh ba phương án của lần chạy mẫu' })
  expect(within(table).getAllByRole('cell').every((cell) => cell.textContent === '')).toBe(true)
  expect(journey.getByText(/^Trình duyệt này không chạy bộ tối ưu mẫu/)).toBeInTheDocument()
  // Hai số cố định của lần chạy, mỗi số một câu nguồn: giá trị là định nghĩa thứ nhất của từng cặp, câu nguồn là định nghĩa thứ hai
  expect(journey.getAllByRole('term').map((term) => term.textContent)).toStrictEqual([
    'cho một lần chạy, cả ba phương án',
    'cho 1.000 kiện, đủ ba phương án',
  ])
  const definitions = journey.getAllByRole('definition').map((definition) => definition.textContent)
  expect(definitions.filter((_, index) => index % 2 === 0)).toStrictEqual(['2 credit', '< 1 giây'])
  const sources = definitions.filter((_, index) => index % 2 === 1)
  expect(sources).toHaveLength(2)
  for (const source of sources) expect(source?.trim()).not.toBe('')

  const plans = within(screen.getByRole('region', { name: 'Gói cước' }))
  expect(await plans.findByRole('group', { name: 'Pro' }, SLOW)).toHaveTextContent('10.000 credit mỗi tháng')
  expect(plans.getByRole('group', { name: 'Ultimate' })).toHaveTextContent('Không giới hạn')
  expect(plans.getByRole('group', { name: 'Basic' })).toHaveTextContent('Giá trị tạm — chờ chốt')
  expect(plans.getByRole('link', { name: 'So sánh các gói' })).toHaveAttribute('href', '/bang-gia')
})

test('with motion on, split text keeps every accessible name: the title, the section headings and the five legs of a trip', () => {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({})
  renderLanding('/gioi-thieu')
  expect(document.querySelector('[data-reveal-root]')).toHaveAttribute('data-motion', 'on')

  const title = 'Tới điểm nào, mở cửa là thấy hàng của điểm đó.'
  const h1 = screen.getByRole('heading', { level: 1, name: title })
  // Chữ đã tách thành mảnh chỉ để nhìn; tên truy cập vẫn là đúng một câu
  expect(h1.querySelector('[aria-hidden="true"]')).not.toBeNull()
  expect(screen.getByRole('region', { name: title })).toBeInTheDocument()
  for (const name of ['Ba chuyện quen thuộc của một chuyến hàng', 'Một chuyến hàng trên LoadMaster', 'Gói cước', 'Hỏi đáp', 'Liên hệ với LoadMaster']) {
    expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
  }
  for (const name of CHAPTER_TITLES) expect(screen.getByRole('heading', { level: 3, name })).toBeInTheDocument()

  // Nội dung chờ ở trạng thái đầu tới khi cuộn tới; báo giao cắt thì mọi cổng mở, một lần
  const gates = [...document.querySelectorAll('[data-reveal-gate]')]
  expect(gates.length).toBeGreaterThan(0)
  io.triggerAll()
  expect(gates.every((gate) => gate.hasAttribute('data-shown'))).toBe(true)
  expect(screen.queryByText(/MOCK/)).not.toBeInTheDocument()
})

test('the skip link moves focus to the main content without changing the address', async () => {
  const user = userEvent.setup()
  renderLanding('/gioi-thieu')
  await user.click(screen.getByRole('link', { name: 'Bỏ qua tới nội dung chính' }))
  expect(screen.getByRole('main')).toHaveFocus()
  expect(screen.queryByText(/Đang ở/)).not.toBeInTheDocument()
})

test('the header menu lists the three sections; picking one moves focus to that section, not back to the menu button', async () => {
  const user = userEvent.setup()
  renderLanding('/gioi-thieu')
  await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Menu trang' }))
  const items = screen.getAllByRole('menuitem')
  expect(items.map((item) => [item.textContent, item.getAttribute('href')])).toStrictEqual([
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

test('the contact form needs a name, a valid email and the privacy consent, refuses a too-fast send, keeps the input when sending fails, then sends a NEW request', async () => {
  const clock = fakeClock()
  const user = userEvent.setup()
  const create = vi.spyOn(getMockDb(), 'createGuestContact')
  renderLanding('/gioi-thieu?goi=PLAN-002&loai=bao-gia#lien-he')
  // Tới qua neo: tiêu đề của phần nhận focus
  expect(screen.getByRole('heading', { level: 2, name: 'Liên hệ với LoadMaster' })).toHaveFocus()
  const submit = await screen.findByRole('button', { name: 'Gửi yêu cầu' }, SLOW)
  expect(screen.getByRole('combobox', { name: 'Bạn cần gì' })).toHaveTextContent('Hỗ trợ tư vấn')
  expect(screen.getByRole('combobox', { name: 'Gói quan tâm' })).toHaveTextContent('Pro')

  await user.click(submit)
  const name = screen.getByRole('textbox', { name: 'Họ tên' })
  const email = screen.getByRole('textbox', { name: 'Email' })
  expect(await screen.findByText('Nhập họ tên')).toBeInTheDocument()
  expect(screen.getByText('Nhập email')).toBeInTheDocument()
  expect(name).toHaveAttribute('aria-invalid', 'true')
  // Ô đồng ý bắt đầu trống và chặn gửi; câu lỗi nối vào ô
  const consent = screen.getByRole('checkbox', { name: CONSENT })
  expect(consent).not.toBeChecked()
  expect(consent).toHaveAttribute('aria-invalid', 'true')
  expect(consent).toHaveAccessibleDescription('Đánh dấu ô đồng ý để gửi yêu cầu')
  // Nhãn dẫn tới chính sách bảo mật, mở ở thẻ mới cùng ngôn ngữ đang dùng
  const policy = screen.getByRole('link', { name: /^chính sách bảo mật\s?\(mở trong thẻ mới\)$/ })
  expect(policy).toHaveAttribute('href', '/chinh-sach-bao-mat?lang=vi')
  expect(policy).toHaveAttribute('target', '_blank')

  await user.type(name, 'Trần Minh Quân')
  await user.type(email, 'quan@')
  await user.click(submit)
  expect(await screen.findByText('Email không đúng định dạng')).toBeInTheDocument()

  await user.clear(email)
  await user.type(email, 'quan@vantaiminhquan.vn')
  await user.type(screen.getByRole('textbox', { name: 'Tên công ty' }), 'Vận tải Minh Quân')
  await user.type(screen.getByRole('textbox', { name: 'Nội dung' }), 'Đội 12 xe tải, cần báo giá gói Pro.')
  // Chưa đánh dấu đồng ý: vẫn không gửi
  await user.click(submit)
  expect(screen.getByText('Đánh dấu ô đồng ý để gửi yêu cầu')).toBeInTheDocument()
  expect(create).not.toHaveBeenCalled()
  await user.click(consent)
  expect(consent).toBeChecked()
  await waitFor(() => expect(screen.queryByText('Đánh dấu ô đồng ý để gửi yêu cầu')).not.toBeInTheDocument())

  // Gửi ngay khi form vừa hiện (dưới 3 giây): coi như chương trình tự động — không gọi kho, không báo thành công, banner ngay trên nút
  await user.click(submit)
  const blocked = await screen.findByText(BLOCKED)
  expect(blocked.closest('[role="alert"]')).not.toBeNull()
  expect(create).not.toHaveBeenCalled()
  expect(screen.queryByRole('heading', { name: /Đã ghi nhận yêu cầu/ })).not.toBeInTheDocument()
  expect(name).toHaveValue('Trần Minh Quân')
  expect(consent).toBeChecked()

  // Đủ 3 giây. Kho từ chối: banner nói mục nào, dữ liệu đang nhập giữ nguyên
  clock.wait(3000)
  create.mockRejectedValueOnce(new MockDbError('CONTACT_INVALID', { field: 'email' }))
  await user.click(submit)
  const refused = await screen.findByText('Mục "Email" của yêu cầu liên hệ chưa hợp lệ. Kiểm tra lại mục đó rồi thử lại.')
  expect(refused.closest('[role="alert"]')).not.toBeNull()
  expect(name).toHaveValue('Trần Minh Quân')
  expect(email).toHaveValue('quan@vantaiminhquan.vn')
  expect(screen.queryByText(BLOCKED)).not.toBeInTheDocument()

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
  // Ô đồng ý và ô bẫy không bao giờ đi theo yêu cầu
  expect(create).toHaveBeenCalledTimes(2)
  expect(Object.keys(create.mock.calls[1]?.[0] ?? {}).sort()).toStrictEqual(['companyName', 'email', 'fullName', 'interestedPlanId', 'message', 'requestType'])
})

test('a filled trap field blocks the send without calling the store; a real person sends again once it is empty', async () => {
  const clock = fakeClock()
  const user = userEvent.setup()
  const create = vi.spyOn(getMockDb(), 'createGuestContact')
  renderLanding('/gioi-thieu#lien-he')
  const submit = await screen.findByRole('button', { name: 'Gửi yêu cầu' }, SLOW)

  // Ô bẫy: ngoài khung nhìn, trình đọc màn hình không đọc, phím Tab không tới, trình duyệt không tự điền
  const trap = document.querySelector<HTMLInputElement>('input[name="website"]')
  expect(trap).not.toBeNull()
  expect(trap?.closest('[aria-hidden]')).not.toBeNull()
  expect(trap).toHaveAttribute('tabindex', '-1')
  expect(trap).toHaveAttribute('autocomplete', 'off')
  expect(screen.queryByRole('textbox', { name: 'Để trống ô này' })).not.toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: 'Họ tên' }), 'Phạm Thu Trang')
  await user.type(screen.getByRole('textbox', { name: 'Email' }), 'trang@vantaicuulong.vn')
  await user.click(screen.getByRole('checkbox', { name: CONSENT }))
  clock.wait(60_000)
  await user.type(trap as HTMLInputElement, 'https://spam.example')
  await user.click(submit)
  expect(await screen.findByText(BLOCKED)).toBeInTheDocument()
  expect(create).not.toHaveBeenCalled()
  expect(screen.getByRole('textbox', { name: 'Họ tên' })).toHaveValue('Phạm Thu Trang')

  // Lần gửi bị chặn xoá ô bẫy: người thật bấm gửi lần nữa là đi
  expect(trap).toHaveValue('')
  await user.click(submit)
  expect(await screen.findByRole('heading', { name: /^Đã ghi nhận yêu cầu LH-\d+$/ }, SLOW)).toHaveFocus()
  expect(create).toHaveBeenCalledTimes(1)
})

test('a signed-in company admin is offered the app, not the sign-in screen', async () => {
  signedInAs('companyAdmin')
  renderLanding('/gioi-thieu')
  expect(await within(screen.getByRole('banner')).findByRole('link', { name: 'Vào ứng dụng' })).toHaveAttribute('href', '/nguoi-dung')
})
