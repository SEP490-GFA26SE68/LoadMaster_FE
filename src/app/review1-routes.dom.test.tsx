import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test } from 'vitest'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { routes } from './App'
import { Providers } from './providers'

/**
 * LM-104, FE-0-06: route Review 1 trong bảng route thật — đúng nhóm quyền, tiêu đề tab, và khung màn đếm dữ liệu thật của kho (seed neo
 * 14/09/2026, kho dùng chung có độ trễ giả). Vai trò không có quyền gặp màn 403; route đã bỏ (lô hàng, nhận hàng) là màn 404.
 */
const SLOW = { timeout: 8000 }

function openAt(path: string, role: Role) {
  signedInAs(role)
  render(<Providers><RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} /></Providers>)
}

beforeEach(() => {
  sessionStorage.clear()
  document.title = ''
})

test.each<[Role, string, string, string]>([
  // FE-0-06: ba màn kiện là của điều phối viên (`packages.manage`); điều phối thấy cả 88 kiện của kho kiện Long Bình
  ['dispatcher', '/kien-hang', 'Kiện hàng', '88 kiện đã đăng ký'],
  ['dispatcher', '/loai-kien', 'Loại kiện', '8 loại kiện trong danh mục'],
  ['dispatcher', '/kien-hang/nhan?kien=PK-0001,PK-0002', 'In nhãn QR', '2 nhãn có thể in'],
  ['dispatcher', '/don-hang', 'Đơn hàng', '2 đơn chờ gán vào chuyến'],
  ['dispatcher', '/doi-xe/loai-xe', 'Loại xe', '7 loại xe, gắn cho 7 xe'],
])('%s mở %s', async (role, path, title, summary) => {
  openAt(path, role)
  expect(await screen.findByRole('heading', { level: 1, name: title }, SLOW)).toBeInTheDocument()
  expect(await screen.findByText(summary, {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(document.title).toBe(`${title} · LoadMaster`))
})

test('the trip report summarizes a completed trip from its recorded progress', async () => {
  openAt('/chuyen/TRIP-003/bao-cao', 'manager')
  expect(await screen.findByText('144 / 145 kiện đã giao · 0 sự cố', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(document.title).toBe('Báo cáo chuyến TRIP-003 · LoadMaster'))
})

test.each<[Role, string]>([
  ['warehouse', '/don-hang'],
  // FE-0-01: quản trị hệ thống không còn quyền vận hành
  ['systemAdmin', '/don-hang'],
  ['systemAdmin', '/kien-hang'],
  // FE-0-06: `packages.view` của quản lý công ty và `labels.print` của kho chưa mở màn nào; ba màn kiện theo `packages.manage`
  ['manager', '/kien-hang'],
  ['manager', '/loai-kien'],
  ['warehouse', '/kien-hang/nhan'],
  ['companyAdmin', '/loai-kien'],
])('%s không mở được %s', async (role, path) => {
  openAt(path, role)
  expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' }, SLOW)).toBeInTheDocument()
})

/** FE-0-06: lô hàng và nhận hàng đã bỏ — đường dẫn cũ là màn 404 (không phải 403) với mọi vai trò, kể cả vai trò từng mở được màn kiện. */
test.each<[Role, string]>([
  ['dispatcher', '/lo-hang'],
  ['dispatcher', '/lo-hang/SHP-002'],
  ['dispatcher', '/nhan-hang'],
  ['warehouse', '/nhan-hang'],
  ['systemAdmin', '/lo-hang'],
])('%s mở %s gặp màn không tìm thấy trang', async (role, path) => {
  openAt(path, role)
  expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy trang' }, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(document.title).toBe('Không tìm thấy trang · LoadMaster'))
})

/** FE-0-07: hàng đợi duyệt của quản lý đã bỏ — đường dẫn cũ là màn 404, không phải 403. */
test.each<Role>(['manager', 'dispatcher'])('%s mở /duyet gặp màn không tìm thấy trang', async (role) => {
  openAt('/duyet', role)
  expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy trang' }, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(document.title).toBe('Không tìm thấy trang · LoadMaster'))
})
