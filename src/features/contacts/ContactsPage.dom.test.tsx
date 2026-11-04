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
    ['Lê Hoàng NamLH-001 · Công ty TNHH Vận tải Minh Phát', 'nam.le@vantaiminhphat.vn0903 412 875', 'Báo giá', 'Pro', 'Mới', 'Chưa ai nhận'],
    ['Phạm Thu TrangLH-002 · Giao nhận Hoà An', 'trang.pham@giaonhanhoaan.com0938 220 641', 'Xem demo', 'Chưa chọn', 'Đang xử lý', 'Tạ Thị Ngọc Ánh'],
    ['Trần Quốc BảoLH-003', 'bao.tran@logisticsvietbac.vn', 'Hỏi thông tin', 'Chưa chọn', 'Đã giải quyết', 'Tạ Thị Ngọc Ánh'],
  ])

  await user.click(screen.getByRole('combobox', { name: 'Trạng thái' }))
  await user.click(await screen.findByRole('option', { name: 'Mới' }))
  await waitFor(() => expect(screen.getByLabelText('url')).toHaveTextContent('trang-thai=moi'))
  expect((await dataRows()).map((row) => row.textContent)).toStrictEqual([expect.stringContaining('LH-001')])

  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  await user.click(screen.getByRole('combobox', { name: 'Loại' }))
  await user.click(await screen.findByRole('option', { name: 'Xem demo' }))
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

test('status, assignee and note of a new request are saved together; then the button dims again and the panel title takes the focus', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=LH-001')
  const panel = await screen.findByRole('region', { name: 'Lê Hoàng Nam' }, SLOW)
  const save = within(panel).getByRole('button', { name: 'Lưu thay đổi' })
  expect(save).toBeDisabled()
  expect(save).toHaveAccessibleDescription('Chưa có gì thay đổi để lưu')

  await user.click(within(panel).getByRole('combobox', { name: 'Trạng thái' }))
  await user.click(await screen.findByRole('option', { name: 'Đang xử lý' }))
  await user.click(within(panel).getByRole('combobox', { name: 'Người nhận việc' }))
  await user.click(await screen.findByRole('option', { name: 'Tạ Thị Ngọc Ánh · Hỗ trợ khách hàng' }))
  await user.type(within(panel).getByRole('textbox', { name: 'Ghi chú nội bộ' }), 'Đã gửi báo giá gói Pro qua email.')
  expect(save).toBeEnabled()
  await user.click(save)

  expect(await screen.findByText('3 yêu cầu · 0 mới', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(within(panel).getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled())
  expect(within(panel).getByRole('heading', { level: 2, name: 'Lê Hoàng Nam' })).toHaveFocus()
  expect(await getMockDb().getGuestContact('LH-001')).toMatchObject({
    status: 'IN_PROGRESS', assignedToId: SUPPORTER, assignedToName: 'Tạ Thị Ngọc Ánh', note: 'Đã gửi báo giá gói Pro qua email.',
  })
  expect((await getMockDb().listEvents({ targetId: 'LH-001' })).map((event) => event.action)).toStrictEqual(['contact.updated'])
})

test('a change another person saved while the panel is open is shown, not overwritten: only the field edited here is sent', async () => {
  const user = userEvent.setup()
  const client = renderContacts('?lien-he=LH-001')
  const panel = await screen.findByRole('region', { name: 'Lê Hoàng Nam' }, SLOW)
  const status = within(panel).getByRole('combobox', { name: 'Trạng thái' })
  const assignee = within(panel).getByRole('combobox', { name: 'Người nhận việc' })
  const note = within(panel).getByRole('textbox', { name: 'Ghi chú nội bộ' })
  const save = within(panel).getByRole('button', { name: 'Lưu thay đổi' })

  await asOtherUser(PLATFORM_MANAGER, (db) => db.updateGuestContact('LH-001', { status: 'RESOLVED', assignedToId: PLATFORM_MANAGER }))
  await act(() => client.invalidateQueries({ queryKey: ['contacts'] }))
  await waitFor(() => expect(status).toHaveTextContent('Đã giải quyết'))
  expect(assignee).toHaveTextContent('Đinh Quang Huy · Quản lý nền tảng')
  expect(save).toBeDisabled()

  // Đang sửa ghi chú thì người kia đóng yêu cầu: ô trạng thái theo kho, chữ đang nhập giữ nguyên
  await user.clear(note)
  await user.type(note, 'Khách hẹn gọi lại tuần sau.')
  await asOtherUser(PLATFORM_MANAGER, (db) => db.updateGuestContact('LH-001', { status: 'CLOSED' }))
  await act(() => client.invalidateQueries({ queryKey: ['contacts'] }))
  await waitFor(() => expect(status).toHaveTextContent('Đã đóng'))
  expect(note).toHaveValue('Khách hẹn gọi lại tuần sau.')
  await user.click(save)

  await waitFor(() => expect(within(panel).getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled())
  expect(await getMockDb().getGuestContact('LH-001')).toMatchObject({
    status: 'CLOSED', assignedToId: PLATFORM_MANAGER, assignedToName: 'Đinh Quang Huy', note: 'Khách hẹn gọi lại tuần sau.',
  })
  expect((await getMockDb().listEvents({ targetId: 'LH-001' }))[0]).toMatchObject({ actorId: SUPPORTER, params: { fields: 'note' } })
})

test('a save the store refuses keeps everything that was entered and says which field is wrong', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=LH-002')
  const panel = await screen.findByRole('region', { name: 'Phạm Thu Trang' }, SLOW)
  await user.click(within(panel).getByRole('combobox', { name: 'Người nhận việc' }))
  await user.click(await screen.findByRole('option', { name: 'Đinh Quang Huy · Quản lý nền tảng' }))
  // Người được chọn bị khoá trước khi bấm lưu
  await asOtherUser(SYSTEM_ADMIN, (db) => db.setUserStatus(PLATFORM_MANAGER, 'suspended'))
  await user.click(within(panel).getByRole('button', { name: 'Lưu thay đổi' }))

  expect(await screen.findByText('Mục "Người nhận việc" của yêu cầu liên hệ chưa hợp lệ. Kiểm tra lại mục đó rồi thử lại.', {}, SLOW)).toBeInTheDocument()
  expect(within(panel).getByRole('combobox', { name: 'Người nhận việc' })).toHaveTextContent('Đinh Quang Huy · Quản lý nền tảng')
  expect(within(panel).getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled()
  expect((await getMockDb().getGuestContact('LH-002')).assignedToId).toBe(SUPPORTER)
})

test('a locked person who still holds a request is shown by name but cannot be picked again', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=LH-001')
  const panel = await screen.findByRole('region', { name: 'Lê Hoàng Nam' }, SLOW)
  const assignee = within(panel).getByRole('combobox', { name: 'Người nhận việc' })
  await waitFor(() => expect(assignee).toHaveTextContent('Đinh Quang Huy'))
  await user.click(assignee)
  expect(await screen.findByRole('option', { name: 'Đinh Quang Huy' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.queryByRole('option', { name: 'Đinh Quang Huy · Quản lý nền tảng' })).not.toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Tạ Thị Ngọc Ánh · Hỗ trợ khách hàng' })).not.toHaveAttribute('aria-disabled')
})

test('when plan names cannot be read the row shows the plan code; a guest who chose no plan still reads "none chosen"', async () => {
  vi.spyOn(getMockDb(), 'listSubscriptionPlans').mockRejectedValueOnce(new Error('offline'))
  renderContacts()
  const rows = await dataRows()
  await waitFor(() => expect(within(rows[0]!).getAllByRole('cell')[4]).toHaveTextContent('PLAN-002'))
  expect(within(rows[1]!).getAllByRole('cell')[4]).toHaveTextContent('Chưa chọn')
})

test('when the people who can take requests cannot be read the assignee field says so', async () => {
  vi.spyOn(getMockDb(), 'listUsers').mockRejectedValueOnce(new Error('offline'))
  renderContacts('?lien-he=LH-002')
  const panel = await screen.findByRole('region', { name: 'Phạm Thu Trang' }, SLOW)
  const assignee = within(panel).getByRole('combobox', { name: 'Người nhận việc' })
  await waitFor(() => expect(assignee).toHaveAccessibleDescription('Chưa tải được danh sách người nhận việc. Tải lại trang để thử lại.'))
  expect(assignee).toHaveTextContent('Tạ Thị Ngọc Ánh')
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
