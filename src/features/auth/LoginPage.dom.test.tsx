import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, test } from 'vitest'
import { NavRail } from '@/app/NavRail'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { I18nProvider } from '@/lib/i18n'
import { AuthProvider } from './AuthProvider'
import { LoginPage } from './LoginPage'
import { RequireAuth } from './RequireAuth'

/** Hình minh hoạ màn đăng nhập đọc `prefers-reduced-motion`; jsdom chưa có `matchMedia`. */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

function Where() {
  const location = useLocation()
  return <p>Đang ở {location.pathname + location.search}</p>
}

/** Seam: màn đăng nhập thật + tài khoản demo; route đích chỉ in đường dẫn. */
function renderLogin(from?: string) {
  render(
    <I18nProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[{ pathname: '/dang-nhap', state: from ? { from } : null }]}>
          <Routes>
            <Route path="/dang-nhap" element={<LoginPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
}

async function signInAs(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), 'loadmaster')
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

beforeEach(() => sessionStorage.clear())

test.each([
  ['kho@loadmaster.vn', '/kho'],
  ['taixe@loadmaster.vn', '/tai-xe'],
  ['dieuphoi@loadmaster.vn', '/chuyen'],
  ['quanly@loadmaster.vn', '/'],
  ['quantri@loadmaster.vn', '/nguoi-dung'],
  // FE-0-03: quản trị công ty; hai vai trò nền tảng chưa có màn riêng mở hồ sơ cá nhân; tài khoản của Phương Nam
  ['qtcongty@loadmaster.vn', '/nguoi-dung'],
  ['nentang@loadmaster.vn', '/nen-tang/goi'],
  ['hotro@loadmaster.vn', '/ho-so'],
  ['dieuphoi@phuongnam.vn', '/chuyen'],
  // FE-0-06: `viet.lam@` là nhân viên kho của Phương Nam (trước là tài khoản logistics mở `/nhan-hang`)
  ['viet.lam@phuongnam.vn', '/kho'],
])('%s opening the app root lands on %s', async (email, home) => {
  renderLogin('/')
  await signInAs(email)
  expect(await screen.findByText(`Đang ở ${home}`, {}, { timeout: 3000 })).toBeInTheDocument()
})

/** Ô đăng nhập nhanh (FE-0-03): một nhóm cho nền tảng, một nhóm cho mỗi công ty có tài khoản dùng thử; mỗi dòng là "vai trò + email". */
test('the quick sign-in box groups the demo accounts by platform and company; picking one fills the form', async () => {
  const user = userEvent.setup()
  renderLogin()
  const rows = (group: string) => within(screen.getByRole('group', { name: group })).getAllByRole('button').map((button) => button.textContent)

  // Tên nhóm là dòng đầu của nhóm (cũng là tên truy cập của nhóm): nền tảng và hai công ty logistics — không còn nhóm nhà sản xuất (FE-0-06)
  expect(screen.getAllByRole('group').map((group) => group.firstElementChild?.textContent))
    .toStrictEqual(['Nền tảng', 'Công ty TNHH Vận tải Long Bình', 'Công ty CP Giao nhận Phương Nam'])
  // Quản lý nền tảng và hỗ trợ khách hàng chưa có màn riêng (Sprint 8) nên chưa có trong ô chọn nhanh
  expect(rows('Nền tảng')).toStrictEqual(['Quản trị hệ thốngquantri@loadmaster.vn'])
  expect(rows('Công ty TNHH Vận tải Long Bình')).toStrictEqual([
    'Quản trị công tyqtcongty@loadmaster.vn', 'Quản lý công tyquanly@loadmaster.vn', 'Điều phối viêndieuphoi@loadmaster.vn',
    'Nhân viên khokho@loadmaster.vn', 'Tài xếtaixe@loadmaster.vn',
  ])
  // Phương Nam đủ năm vai trò công ty
  expect(rows('Công ty CP Giao nhận Phương Nam')).toStrictEqual([
    'Quản trị công tyqtcongty@phuongnam.vn', 'Quản lý công tyquanly@phuongnam.vn', 'Điều phối viêndieuphoi@phuongnam.vn',
    'Nhân viên khoviet.lam@phuongnam.vn', 'Tài xếtaixe@phuongnam.vn',
  ])
  // Không dòng nào còn mang nhãn vai trò đã bỏ
  expect(screen.queryByText(/Nhà sản xuất|logistics/i)).not.toBeInTheDocument()

  await user.click(within(screen.getByRole('group', { name: 'Công ty CP Giao nhận Phương Nam' })).getByRole('button', { name: /Quản lý công ty/ }))
  expect(screen.getByLabelText('Email')).toHaveValue('quanly@phuongnam.vn')
  expect(screen.getByLabelText('Mật khẩu')).toHaveValue('loadmaster')
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  expect(await screen.findByText('Đang ở /', {}, { timeout: 3000 })).toBeInTheDocument()
})

test('signing out and in as another role lands on that role screen, not on the page the previous user left', async () => {
  const user = userEvent.setup()
  // Chuông thông báo của nav rail (LM-098) đọc kho qua TanStack Query
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={['/dang-nhap']}>
              <Routes>
                <Route path="/dang-nhap" element={<LoginPage />} />
                <Route element={<RequireAuth />}>
                  <Route path="*" element={<><NavRail /><Where /></>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  await signInAs('dieuphoi@loadmaster.vn')
  expect(await screen.findByText('Đang ở /chuyen', {}, { timeout: 3000 })).toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: 'Đội xe' }))
  expect(screen.getByText('Đang ở /doi-xe')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Tài khoản/ }))
  await user.click(await screen.findByRole('menuitem', { name: 'Đăng xuất' }))

  await screen.findByLabelText('Email', {}, { timeout: 3000 })
  await signInAs('kho@loadmaster.vn')
  expect(await screen.findByText('Đang ở /kho', {}, { timeout: 3000 })).toBeInTheDocument()
}, 15_000)

/**
 * FE-0-08: nhân sự công ty do quản trị công ty của họ khoá và mở khoá, tài khoản nền tảng do quản trị hệ thống — câu báo khoá không chỉ
 * người dùng tới sai người. Bùi Thị Lan (`lan.bui@`, nhân viên kho của Long Bình) là tài khoản bị khoá của seed.
 */
test('a locked account is told to contact its own administrator, not the system administrator', async () => {
  renderLogin('/')
  await signInAs('lan.bui@loadmaster.vn')
  expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent(/^Tài khoản đã bị khoá\. Liên hệ quản trị viên của bạn để mở khoá\.$/)
  expect(screen.queryByText(/Đang ở/)).not.toBeInTheDocument()
})

test('a deep link opened before signing in is kept for any role', async () => {
  renderLogin('/chuyen/TRIP-2026-0914/phuong-an?revision=REV-002')
  await signInAs('kho@loadmaster.vn')
  expect(await screen.findByText('Đang ở /chuyen/TRIP-2026-0914/phuong-an?revision=REV-002', {}, { timeout: 3000 })).toBeInTheDocument()
})
