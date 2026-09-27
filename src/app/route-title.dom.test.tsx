import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test } from 'vitest'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { routes } from './App'
import { Providers } from './providers'

/**
 * LM-100: tiêu đề tab đọc từ `handle` của bảng route thật trong `App.tsx` — "<tên màn> · LoadMaster", màn có mã thì kèm mã,
 * dịch theo ngôn ngữ đang chọn; thiếu quyền là tên màn 403, đường dẫn lạ là tên màn 404.
 */
/** Hình minh hoạ màn đăng nhập đọc `prefers-reduced-motion`; jsdom chưa có `matchMedia`. */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

function openAt(path: string, role?: Role) {
  if (role) signedInAs(role)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<Providers><RouterProvider router={router} /></Providers>)
  return router
}

beforeEach(() => {
  sessionStorage.clear()
  document.title = ''
})

test('a trip names its tab with the trip code and follows the interface language', async () => {
  const user = userEvent.setup()
  openAt('/chuyen/TRIP-011', 'dispatcher')
  await waitFor(() => expect(document.title).toBe('Chuyến TRIP-011 · LoadMaster'))

  // V2.3: ngôn ngữ trên thanh điều hướng là một nút mở menu chọn
  await user.click(await screen.findByRole('button', { name: 'Ngôn ngữ giao diện' }))
  await user.click(await screen.findByRole('menuitemradio', { name: 'EN English' }))
  await waitFor(() => expect(document.title).toBe('Trip TRIP-011 · LoadMaster'))
})

test('moving to another screen renames the tab; a query code is part of the name', async () => {
  const router = openAt('/chuyen', 'admin')
  await waitFor(() => expect(document.title).toBe('Chuyến hàng · LoadMaster'))

  await router.navigate('/doi-xe/VEHICLE-002')
  await waitFor(() => expect(document.title).toBe('Xe VEHICLE-002 · LoadMaster'))
  await router.navigate('/tai-xe/diem-giao?chuyen=TRIP-009')
  await waitFor(() => expect(document.title).toBe('Giao hàng TRIP-009 · LoadMaster'))
  await router.navigate('/tai-xe')
  await waitFor(() => expect(document.title).toBe('Chuyến của tôi · LoadMaster'))
})

test('a screen the role cannot open is named after the 403 screen, an unknown path after the 404 screen', async () => {
  const router = openAt('/nguoi-dung', 'dispatcher')
  await screen.findByRole('heading', { name: 'Không có quyền truy cập' })
  await waitFor(() => expect(document.title).toBe('Không có quyền truy cập · LoadMaster'))

  await router.navigate('/khong-co-trang-nay')
  await screen.findByRole('heading', { name: 'Không tìm thấy trang' })
  await waitFor(() => expect(document.title).toBe('Không tìm thấy trang · LoadMaster'))
  // Nút về màn chính mở màn của vai trò (điều phối: danh sách chuyến), như màn 403
  expect(screen.getByRole('link', { name: 'Về màn chính' })).toHaveAttribute('href', '/chuyen')
})

test('signing in is named before any account is open', async () => {
  openAt('/chuyen')
  await screen.findByRole('button', { name: 'Đăng nhập' })
  await waitFor(() => expect(document.title).toBe('Đăng nhập · LoadMaster'))
})
