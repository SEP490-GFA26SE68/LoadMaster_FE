import { render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test } from 'vitest'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { routes } from './App'
import { Providers } from './providers'

/**
 * LM-104: route Review 1 trong bảng route thật — đúng nhóm quyền, tiêu đề tab, và khung màn đếm dữ liệu thật của kho (seed neo
 * 14/09/2026, kho dùng chung có độ trễ giả). Vai trò không có quyền gặp màn 403.
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
  ['manufacturer', '/kien-hang', 'Kiện hàng', '42 kiện đã đăng ký'],
  ['manufacturer', '/loai-kien', 'Loại kiện', '8 loại kiện trong danh mục'],
  ['manufacturer', '/lo-hang', 'Lô hàng', '2 lô hàng'],
  ['logistics', '/nhan-hang', 'Nhận hàng', '8 kiện đang chờ quét nhận'],
  ['dispatcher', '/don-hang', 'Đơn hàng', '2 đơn chờ gán vào chuyến'],
  ['manager', '/duyet', 'Chờ duyệt', '1 phương án chờ duyệt'],
  ['dispatcher', '/doi-xe/loai-xe', 'Loại xe', '7 loại xe, gắn cho 7 xe'],
  ['admin', '/lo-hang/SHP-002', 'Lô hàng SHP-002', '12 kiện trong lô, đã nhận 4'],
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
  ['logistics', '/kien-hang'],
  ['manufacturer', '/nhan-hang'],
  ['warehouse', '/don-hang'],
  ['dispatcher', '/duyet'],
])('%s không mở được %s', async (role, path) => {
  openAt(path, role)
  expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' }, SLOW)).toBeInTheDocument()
})
