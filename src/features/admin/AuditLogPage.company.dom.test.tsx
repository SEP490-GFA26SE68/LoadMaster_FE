import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { AuditLogPage } from './AuditLogPage'

/**
 * Nhật ký trong phạm vi **công ty** (FE-0-08): người xem là quản trị công ty demo của Long Bình (US-LB-01). Seed neo 14/09/2026 có 134
 * sự kiện: 127 của Long Bình (123 việc người Long Bình làm, 4 việc quản trị hệ thống làm trên tài khoản của Long Bình) và 7 của Phương
 * Nam. Không test nào trong file ghi vào kho. Phạm vi của quản trị hệ thống ở `AuditLogPage.dom.test.tsx`.
 */
const SLOW = { timeout: 5000 }

function renderLog(url = '/nhat-ky') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('companyAdmin')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[url]}>
            <AuditLogPage />
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

/** Chữ của ô như trình đọc màn hình đọc: bỏ phần `aria-hidden`, gộp khoảng trắng. */
function cellText(cell: HTMLElement) {
  const copy = cell.cloneNode(true) as HTMLElement
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

async function dataRows() {
  const table = await screen.findByRole('table', {}, SLOW)
  return within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map(cellText))
}

test('chỉ sự kiện của công ty mình: 127 trên 134, không có bộ lọc công ty, không tìm ra chuyến của công ty khác', async () => {
  renderLog()
  await dataRows()
  expect(screen.getByText('127 sự kiện')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Sự kiện trong nhật ký' })).toHaveTextContent('127Sự kiện trong nhật ký')
  expect(screen.queryByRole('combobox', { name: 'Công ty' })).toBeNull()
  // Người làm chọn được: người của Long Bình và quản trị hệ thống đã làm việc trên tài khoản của Long Bình — không ai của Phương Nam
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Người làm' }))
  const actors = (await screen.findAllByRole('option')).map((option) => option.textContent)
  expect(actors).toHaveLength(14)
  expect(actors).toStrictEqual(expect.arrayContaining(['Mọi người', 'Dương Thị Kim Oanh', 'Nguyễn Thanh Tùng', 'Võ Minh Khoa']))
  expect(actors.filter((name) => ['Kiều Anh Tuấn', 'Châu Minh Trí', 'Đinh Quang Huy'].includes(name ?? ''))).toStrictEqual([])
})

test('chuyến của công ty khác không có trong nhật ký; tham số công ty trên URL không mở rộng phạm vi', async () => {
  renderLog('/nhat-ky?q=TRIP-PN-001&cong-ty=LOG-002')
  expect(await screen.findByText('Không có sự kiện khớp bộ lọc.', {}, SLOW)).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Sự kiện trong nhật ký' })).toHaveTextContent('127')
})

test('việc quản trị hệ thống làm trên tài khoản của công ty: đọc được, kèm tên người làm và liên kết tới người dùng', async () => {
  renderLog('/nhat-ky?nguoi-lam=US-0005')
  await screen.findByText('4 sự kiện', {}, SLOW)
  // Seed: tạo ba tài khoản (12, 19, 26 ngày trước ngày neo) và khoá một nhân viên kho (17 ngày trước) — mới nhất trước
  expect((await dataRows()).map((row) => row.slice(1, 4))).toStrictEqual([
    ['Võ Minh Khoa Quản trị hệ thống', 'Tạo tài khoản', 'Lý Minh Châu US-0012'],
    ['Võ Minh Khoa Quản trị hệ thống', 'Khoá tài khoản', 'Bùi Thị Lan US-0008'],
    ['Võ Minh Khoa Quản trị hệ thống', 'Tạo tài khoản', 'Đỗ Thị Hạnh US-0011'],
    ['Võ Minh Khoa Quản trị hệ thống', 'Tạo tài khoản', 'Trương Văn Lộc US-0010'],
  ])
  // Quản trị công ty mở được màn Người dùng: đối tượng là liên kết tới đúng người của công ty
  expect(screen.getByRole('link', { name: 'Bùi Thị Lan' })).toHaveAttribute('href', '/nguoi-dung?q=US-0008')
  expect(screen.getByRole('combobox', { name: 'Người làm' })).toHaveTextContent('Võ Minh Khoa')
})
