import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { SupportTicketDialog } from './SupportTicketDialog'

/**
 * "Yêu cầu hỗ trợ" của người dùng công ty (FE-8-07). Điều phối viên của Long Bình có đúng một yêu cầu seed (TKT-001, đang Mở); các test
 * dùng chung kho nên chạy theo thứ tự: xem danh sách, gửi yêu cầu mới và trả lời, rồi đọc câu trả lời của Hỗ trợ khách hàng.
 */
const SLOW = { timeout: 5000 }

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('dispatcher')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter>
            <SupportTicketDialog onClose={() => {}} />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('sending a ticket opens its conversation, and a reply is added to it; an empty form is refused at the field', async () => {
  const user = userEvent.setup()
  renderDialog()
  const dialog = await screen.findByRole('dialog')
  // Danh sách chỉ có yêu cầu seed do chính người này gửi
  const seeded = await within(dialog).findByRole('button', { name: 'Mở yêu cầu Planner tải chậm với phương án nhiều kiện' }, SLOW)
  expect(seeded).toHaveTextContent('TKT-001')
  expect(seeded).toHaveTextContent('Mở')
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)

  await user.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu mới' }))
  await user.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await within(dialog).findByText('Nhập tiêu đề')).toBeInTheDocument()
  expect(within(dialog).getByText('Nhập mô tả')).toBeInTheDocument()

  await user.type(within(dialog).getByRole('textbox', { name: 'Tiêu đề' }), 'Hoá đơn tháng 9')
  await user.type(within(dialog).getByRole('textbox', { name: 'Mô tả' }), 'Cần hoá đơn VAT của kỳ gia hạn gần nhất.')
  await user.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await within(dialog).findByRole('heading', { name: 'Hoá đơn tháng 9' }, SLOW)).toBeInTheDocument()
  expect(within(dialog).getByText('TKT-003')).toBeInTheDocument()
  expect(within(dialog).getByText('Cần hoá đơn VAT của kỳ gia hạn gần nhất.')).toBeInTheDocument()
  expect(within(dialog).getByText('Chưa có trả lời.')).toBeInTheDocument()

  await user.type(within(dialog).getByRole('textbox', { name: 'Trả lời' }), 'Em gửi thêm mã số thuế: 0301234567.')
  await user.click(within(dialog).getByRole('button', { name: 'Gửi trả lời' }))
  const reply = await within(dialog).findByText('Em gửi thêm mã số thuế: 0301234567.', {}, SLOW)
  expect(reply.closest('li')).toHaveTextContent('Nguyễn Thanh Tùng · Điều phối viên')
  expect(within(dialog).queryByText('Chưa có trả lời.')).not.toBeInTheDocument()
})

test('the answer of customer support shows in the sender conversation, and a closed ticket takes no more replies', async () => {
  const user = userEvent.setup()
  const db = getMockDb()
  await db.authenticate('hotro@loadmaster.vn', 'loadmaster')
  await db.replyToSupportTicket('TKT-003', 'Hoá đơn VAT được gửi qua email của quản trị công ty trong 2 ngày làm việc.')
  await db.setSupportTicketStatus('TKT-003', 'CLOSED')
  renderDialog()
  const dialog = await screen.findByRole('dialog')
  await user.click(await within(dialog).findByRole('button', { name: 'Mở yêu cầu Hoá đơn tháng 9' }, SLOW))
  const answer = await within(dialog).findByText(/Hoá đơn VAT được gửi qua email/, {}, SLOW)
  expect(answer.closest('li')).toHaveTextContent('Tạ Thị Ngọc Ánh · Hỗ trợ khách hàng')
  expect(within(dialog).getByText('Đã đóng')).toBeInTheDocument()
  expect(within(dialog).getByText('Yêu cầu đã đóng nên không thêm trả lời được.')).toBeInTheDocument()
  expect(within(dialog).queryByRole('textbox', { name: 'Trả lời' })).not.toBeInTheDocument()
})
