import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { NavRail } from './NavRail'

function renderRail(role: Role, route = '/') {
  signedInAs(role)
  // Chuông thông báo (LM-098) đọc kho qua TanStack Query
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={[route]}>
              <NavRail />
            </MemoryRouter>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

/** LM-053 (D-20): nút Cài đặt chưa mở màn nào nên không hiển thị. */
test('nav rail không có nút Cài đặt', () => {
  renderRail('dispatcher')
  expect(screen.getByRole('link', { name: 'Chuyến hàng' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cài đặt' })).not.toBeInTheDocument()
})

/** Mục đang mở phải nhận ra được bằng trình đọc màn hình (aria-current) và mỗi mục có nhãn chữ nhìn thấy được. */
test('nav rail đánh dấu mục đang mở và hiện nhãn chữ cho từng mục', () => {
  renderRail('dispatcher', '/chuyen/TRIP-2026-0914')
  const trips = screen.getByRole('link', { name: 'Chuyến hàng' })
  expect(trips).toHaveAttribute('aria-current', 'page')
  expect(trips).toHaveTextContent('Chuyến hàng')
  expect(screen.getByRole('link', { name: 'Bảng điều khiển' })).not.toHaveAttribute('aria-current')
})

/**
 * D-41, FE-0-04: mỗi vai trò có danh sách mục riêng, theo thứ tự của vai trò đó (màn chính đứng đầu), chỉ gồm màn đang có và vai trò
 * mở được. Điều phối viên: Chuyến trước, Bảng điều khiển cuối; cả hai có Yêu cầu giao (quản lý công ty lập, điều phối viên xem — FE-4b-02). Không còn mục Lô hàng, Loại kiện,
 * Nhận hàng (FE-0-06).
 */
test.each<[Role, string[]]>([
  ['dispatcher', ['Chuyến hàng', 'Kho kiện', 'Yêu cầu giao', 'Đội xe', 'Bảng điều khiển']],
  ['manager', ['Bảng điều khiển', 'Yêu cầu giao', 'Kho kiện', 'Chuyến hàng', 'Đội xe']],
  ['warehouse', ['Kho']],
  ['driver', ['Tài xế']],
  ['systemAdmin', ['Người dùng', 'Nhật ký']],
  ['companyAdmin', ['Người dùng', 'Nhật ký']],
])('nav rail của %s chỉ có mục được phép, theo thứ tự của vai trò', (role, items) => {
  renderRail(role)
  const nav = screen.getByRole('navigation')
  expect([...nav.querySelectorAll('a')].map((link) => link.textContent)).toStrictEqual(items)
})

/** FE-0-03 (quyết định G1): hai vai trò nền tảng chưa có màn riêng — không vẽ khay điều hướng rỗng, logo và menu tài khoản vẫn có. */
test.each<Role>(['systemManager', 'systemSupporter'])('nav rail của %s không có khay điều hướng', (role) => {
  renderRail(role, '/ho-so')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'LoadMaster — về màn chính' })).toHaveAttribute('href', '/ho-so')
  expect(screen.getByRole('button', { name: /^Tài khoản / })).toBeInTheDocument()
})

/** LM-098: chuông chỉ có ở vai trò có loại thông báo; kho và tài xế không có nút không làm gì (D-20). */
test.each<[Role, boolean]>([
  ['dispatcher', true],
  ['manager', true],
  ['systemAdmin', true],
  ['companyAdmin', true],
  ['warehouse', false],
  ['driver', false],
  ['systemManager', false],
  ['systemSupporter', false],
])('chuông thông báo của %s: %s', (role, shown) => {
  renderRail(role)
  expect(screen.queryByRole('button', { name: /^Thông báo/ }) !== null).toBe(shown)
})

/** LM-099: nút Tìm nhanh chỉ có khi vai trò được xem ít nhất một nhóm (chuyến, xe, người dùng). */
test.each<[Role, boolean]>([
  ['dispatcher', true],
  ['manager', true],
  ['systemAdmin', true],
  ['companyAdmin', true],
  ['warehouse', false],
  ['driver', false],
  ['systemManager', false],
  ['systemSupporter', false],
])('nút Tìm nhanh của %s: %s', (role, shown) => {
  renderRail(role)
  expect(screen.queryByRole('button', { name: 'Tìm nhanh' }) !== null).toBe(shown)
})

/** LM-104, FE-0-04: logo mở bảng điều khiển khi vai trò xem được, không thì màn chính của vai trò — không rơi vào màn 403 hay 404. */
test.each<[Role, string]>([
  ['systemAdmin', '/nguoi-dung'],
  ['systemManager', '/ho-so'],
  ['systemSupporter', '/ho-so'],
  ['companyAdmin', '/nguoi-dung'],
  ['manager', '/'],
  ['dispatcher', '/'],
  ['warehouse', '/kho'],
  ['driver', '/tai-xe'],
])('logo của %s mở %s', (role, href) => {
  renderRail(role)
  expect(screen.getByRole('link', { name: 'LoadMaster — về màn chính' })).toHaveAttribute('href', href)
})

/** Mục Kho kiện (FE-3b-03) mở `/kien-hang` và vẫn là mục đang mở ở trang in nhãn; màn kho, tài xế không có mục này. */
test('mục Kho kiện của điều phối viên mở /kien-hang và sáng ở cả trang in nhãn', () => {
  renderRail('dispatcher', '/kien-hang/nhan')
  const packages = screen.getByRole('link', { name: 'Kho kiện' })
  expect(packages).toHaveAttribute('href', '/kien-hang')
  expect(packages).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('link', { name: 'Lô hàng' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Nhận hàng' })).not.toBeInTheDocument()
})

/** LM-096: menu tài khoản mở hồ sơ cá nhân trước mục đăng xuất. */
test('menu tài khoản có mục Hồ sơ cá nhân mở /ho-so', async () => {
  const user = userEvent.setup()
  renderRail('manager')
  await user.click(screen.getByRole('button', { name: 'Tài khoản Trần Thị Mai' }))
  const items = await screen.findAllByRole('menuitem')
  expect(items.map((item) => item.textContent)).toStrictEqual(['Hồ sơ cá nhân', 'Đăng xuất'])
  expect(items[0]).toHaveAttribute('href', '/ho-so')
  // Dưới tên và email: vai trò và kho trực thuộc
  expect(screen.getByRole('menu')).toHaveTextContent('Trần Thị Maiquanly@loadmaster.vnQuản lý công tyTrụ sở TP. Hồ Chí Minh')
})

/** FE-0-03 (quyết định G13): người dùng nền tảng không thuộc kho nào — menu chỉ còn vai trò, không có dòng kho trống. */
test('menu tài khoản của quản trị hệ thống không có kho', async () => {
  const user = userEvent.setup()
  renderRail('systemAdmin')
  await user.click(screen.getByRole('button', { name: 'Tài khoản Võ Minh Khoa' }))
  await screen.findAllByRole('menuitem')
  expect(screen.getByRole('menu')).toHaveTextContent(/Võ Minh Khoaquantri@loadmaster\.vnQuản trị hệ thốngHồ sơ cá nhânĐăng xuất$/)
})
