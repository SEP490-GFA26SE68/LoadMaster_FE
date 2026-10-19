import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, type MockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { ContactsPage } from './ContactsPage'

/**
 * Màn Liên hệ của khách. Seed: LH-001 Mới (Lê Hoàng Nam, báo giá gói Pro), LH-002 Đang xử lý và LH-003 Đã giải quyết, cả hai giao cho
 * Hỗ trợ khách hàng seed (Tạ Thị Ngọc Ánh, `US-NT-02`). Các test dùng chung kho của app nên chạy theo thứ tự: test sau đọc kho test trước
 * để lại (LH-001 đã có người nhận, Quản lý nền tảng `US-NT-01` bị khoá).
 */
const SLOW = { timeout: 5000 }
const SUPPORTER = 'US-NT-02'
const PLATFORM_MANAGER = 'US-NT-01'
const SYSTEM_ADMIN = 'US-0005'

afterEach(() => vi.restoreAllMocks())

function Url() {
  const { search } = useLocation()
  return <output aria-label="url">{search}</output>
}

function renderContacts(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs(SUPPORTER)
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/lien-he-khach${search}`]}>
            <ContactsPage />
            <Url />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return client
}

/** Một người khác của nền tảng ghi vào kho trong lúc màn đang mở; phiên của kho trở lại người dùng màn ngay sau đó. */
async function asOtherUser(userId: string, action: (db: MockDb) => Promise<unknown>) {
  const db = getMockDb()
  db.restoreSession(userId)
  try {
    await action(db)
  } finally {
    db.restoreSession(SUPPORTER)
  }
}

const dataRows = async () => within(await screen.findByRole('table', {}, SLOW)).getAllByRole('row').slice(1)

test('lists every guest request newest first with the count of new ones; status and type filters live on the URL', async () => {
  const user = userEvent.setup()
  renderContacts()
  expect(await screen.findByText('3 yêu cầu · 1 mới', {}, SLOW)).toBeInTheDocument()
  const rows = await dataRows()
  expect(rows.map((row) => within(row).getAllByRole('cell').slice(1).map((cell) => cell.textContent))).toStrictEqual([
    ['Lê Hoàng NamLH-001 · Công ty TNHH Vận tải Minh Phát', 'nam.le@vantaiminhphat.vn0903 412 875', 'Hỗ trợ tư vấn', 'Pro', 'Mới', 'Chưa ai nhận'],
    ['Phạm Thu TrangLH-002 · Giao nhận Hoà An', 'trang.pham@giaonhanhoaan.com0938 220 641', 'Đăng ký tài khoản dùng thử', 'Chưa chọn', 'Đang xử lý', 'Tạ Thị Ngọc Ánh'],
    ['Trần Quốc BảoLH-003', 'bao.tran@logisticsvietbac.vn', 'Hỏi thông tin', 'Chưa chọn', 'Đã giải quyết', 'Tạ Thị Ngọc Ánh'],
  ])

  await user.click(screen.getByRole('combobox', { name: 'Trạng thái' }))
  await user.click(await screen.findByRole('option', { name: 'Mới' }))
  await waitFor(() => expect(screen.getByLabelText('url')).toHaveTextContent('trang-thai=moi'))
  expect((await dataRows()).map((row) => row.textContent)).toStrictEqual([expect.stringContaining('LH-001')])

  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  await user.click(screen.getByRole('combobox', { name: 'Loại' }))
  await user.click(await screen.findByRole('option', { name: 'Đăng ký tài khoản dùng thử' }))
  await waitFor(() => expect(screen.getByLabelText('url')).toHaveTextContent('loai=xem-demo'))
  expect((await dataRows()).map((row) => row.textContent)).toStrictEqual([expect.stringContaining('LH-002')])
})

test('the name opens the request on the right; closing it gives the focus back to that name', async () => {
  const user = userEvent.setup()
  renderContacts()
  await user.click(await screen.findByRole('link', { name: 'Mở yêu cầu LH-002 của Phạm Thu Trang' }, SLOW))
  await waitFor(() => expect(screen.getByLabelText('url')).toHaveTextContent('lien-he=LH-002'))
  const panel = screen.getByRole('region', { name: 'Phạm Thu Trang' })
  expect(within(panel).getByRole('heading', { level: 2, name: 'Phạm Thu Trang' })).toHaveFocus()
  expect(panel).toHaveTextContent('Muốn xem thử phần xếp hàng 3D')
  expect(within(panel).getByRole('link', { name: 'trang.pham@giaonhanhoaan.com' })).toHaveAttribute('href', 'mailto:trang.pham@giaonhanhoaan.com')
  expect(within(panel).getByRole('textbox', { name: 'Ghi chú nội bộ' })).toHaveValue('Đã gọi điện, hẹn giới thiệu trực tuyến 14:00 thứ Năm.')
  expect(within(screen.getByRole('table')).getAllByRole('columnheader').map((header) => header.textContent))
    .toStrictEqual(['Nhận lúc', 'Người gửi', 'Loại', 'Trạng thái'])

  await user.click(within(panel).getByRole('button', { name: 'Đóng yêu cầu đang xem' }))
  await waitFor(() => expect(screen.getByLabelText('url')).not.toHaveTextContent('lien-he'))
  expect(screen.queryByRole('region', { name: 'Phạm Thu Trang' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('link', { name: 'Mở yêu cầu LH-002 của Phạm Thu Trang' })).toHaveFocus())
})

test('supporter can click "Đảm nhận" on a new contact to assign themselves and set status to in-progress; no status or assignee comboboxes exist', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=LH-001')
  const panel = await screen.findByRole('region', { name: 'Lê Hoàng Nam' }, SLOW)

  // Không cho supporter tự ý thay đổi bằng combobox
  expect(within(panel).queryByRole('combobox', { name: 'Trạng thái' })).not.toBeInTheDocument()
  expect(within(panel).queryByRole('combobox', { name: 'Người nhận việc' })).not.toBeInTheDocument()

  // Không có nút Hủy cho contact
  expect(within(panel).queryByRole('button', { name: /^hủy/i })).not.toBeInTheDocument()

  // Nút "Đảm nhận"
  const claimBtn = within(panel).getByRole('button', { name: 'Đảm nhận' })
  await user.click(claimBtn)

  expect(await screen.findByText('Đã nhận xử lý yêu cầu liên hệ!', {}, SLOW)).toBeInTheDocument()
  expect(await getMockDb().getGuestContact('LH-001')).toMatchObject({
    status: 'IN_PROGRESS',
    assignedToId: SUPPORTER,
  })
})

test('pricing contact has "Đã giải quyết" and "Liên hệ thất bại" buttons; clicking "Liên hệ thất bại" sets status to CLOSED', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=LH-001')
  const panel = await screen.findByRole('region', { name: 'Lê Hoàng Nam' }, SLOW)

  const resolveBtn = within(panel).getByRole('button', { name: 'Đã giải quyết' })
  const failBtn = within(panel).getByRole('button', { name: 'Liên hệ thất bại' })
  expect(resolveBtn).toBeInTheDocument()
  expect(failBtn).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: /^hủy/i })).not.toBeInTheDocument()

  await user.click(failBtn)
  expect(await screen.findByText('Đã cập nhật trạng thái liên hệ thất bại.', {}, SLOW)).toBeInTheDocument()
  expect(await getMockDb().getGuestContact('LH-001')).toMatchObject({
    status: 'CLOSED',
  })
})

test('pricing contact can be resolved via "Đã giải quyết", setting status to RESOLVED', async () => {
  const user = userEvent.setup()
  // Reset LH-001 về IN_PROGRESS để test giải quyết
  await getMockDb().updateGuestContact('LH-001', { status: 'IN_PROGRESS' })
  renderContacts('?lien-he=LH-001')
  const panel = await screen.findByRole('region', { name: 'Lê Hoàng Nam' }, SLOW)

  const resolveBtn = within(panel).getByRole('button', { name: 'Đã giải quyết' })
  await user.click(resolveBtn)
  expect(await screen.findByText('Đã cập nhật yêu cầu thành đã giải quyết!', {}, SLOW)).toBeInTheDocument()
  expect(await getMockDb().getGuestContact('LH-001')).toMatchObject({
    status: 'RESOLVED',
  })
})

test('panel container confines scrolling within its block with max-height, flex-col and overscroll-contain', async () => {
  renderContacts('?lien-he=LH-001')
  const panel = await screen.findByRole('region', { name: 'Lê Hoàng Nam' }, SLOW)
  expect(panel).toHaveClass('max-h-[calc(100vh-140px)]', 'overflow-hidden', 'flex', 'flex-col')
  expect(panel.querySelector('.overflow-y-auto.overscroll-contain')).toBeInTheDocument()
})

test('demo request contact replaces "Đã giải quyết" with forwarding to System Manager; no "Hủy" button exists', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=LH-002')
  const panel = await screen.findByRole('region', { name: 'Phạm Thu Trang' }, SLOW)

  // LH-002 là DEMO_REQUEST: Không có nút "Đã giải quyết", có nút chuyển cho System Manager
  expect(within(panel).queryByRole('button', { name: 'Đã giải quyết' })).not.toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: /^hủy/i })).not.toBeInTheDocument()

  const forwardBtn = within(panel).getByRole('button', { name: /Chuyển giao cho System Manager|Chuyển Quản lý duyệt tạo tài khoản/i })
  expect(forwardBtn).toBeInTheDocument()
})

test('internal note can be updated via "Lưu ghi chú" button', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=LH-002')
  const panel = await screen.findByRole('region', { name: 'Phạm Thu Trang' }, SLOW)

  const noteInput = within(panel).getByRole('textbox', { name: 'Ghi chú nội bộ' })
  const saveNoteBtn = within(panel).getByRole('button', { name: 'Lưu ghi chú' })
  expect(saveNoteBtn).toBeDisabled()

  await user.type(noteInput, ' Đã liên hệ sơ bộ.')
  expect(saveNoteBtn).toBeEnabled()
  await user.click(saveNoteBtn)

  expect(await screen.findByText('Đã lưu ghi chú nội bộ thành công!', {}, SLOW)).toBeInTheDocument()
  expect(await getMockDb().getGuestContact('LH-002')).toMatchObject({
    note: expect.stringContaining('Đã liên hệ sơ bộ.'),
  })
})

test('a list that fails to load says so and loads again with "Try again"', async () => {
  const user = userEvent.setup()
  vi.spyOn(getMockDb(), 'listGuestContacts').mockRejectedValueOnce(new Error('offline'))
  renderContacts()
  expect(await screen.findByText('Có lỗi xảy ra. Thử lại sau.', {}, SLOW)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Thử lại' }))
  expect(await dataRows()).toHaveLength(3)
})

test('with no request yet the screen says where they will come from', async () => {
  vi.spyOn(getMockDb(), 'listGuestContacts').mockResolvedValueOnce([])
  renderContacts()
  expect(await screen.findByText('Chưa có yêu cầu liên hệ nào.', {}, SLOW)).toBeInTheDocument()
  expect(screen.getByText('Khách gửi từ form Liên hệ ở trang giới thiệu sẽ hiện ở đây.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
