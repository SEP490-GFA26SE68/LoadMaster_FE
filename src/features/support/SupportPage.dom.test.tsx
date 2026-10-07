import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { SupportPage } from './SupportPage'

/**
 * Màn Hỗ trợ khách hàng (FE-8-07). Seed: TKT-001 (Long Bình, kỹ thuật, Mở) và TKT-002 (Phương Nam, thanh toán, Đã đóng). Các test dùng
 * chung kho nên chạy theo thứ tự: xem và lọc, trả lời và đổi trạng thái, khung công ty.
 */
const SLOW = { timeout: 5000 }

function Url() {
  const { search } = useLocation()
  return <output aria-label="url">{search}</output>
}

function renderSupport(search = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('systemSupporter')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/ho-tro${search}`]}>
            <SupportPage />
            <Url />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function rowOf(text: string) {
  const table = await screen.findByRole('table', {}, SLOW)
  const row = within(table).getAllByRole('row').find((item) => item.textContent?.includes(text))
  if (!row) throw new Error(`Không có dòng của ${text}`)
  return row
}

test('lists every ticket of every company and filters by status, on the URL', async () => {
  const user = userEvent.setup()
  renderSupport()
  expect(await screen.findByText('2 yêu cầu', {}, SLOW)).toBeInTheDocument()
  const cells = async (text: string) => within(await rowOf(text)).getAllByRole('cell').map((cell) => cell.textContent)
  expect(await cells('TKT-001')).toStrictEqual(['Planner tải chậm với phương án nhiều kiệnTKT-001 · Nguyễn Thanh Tùng', 'Công ty TNHH Vận tải Long Bình', 'Kỹ thuật', 'Mở', expect.stringMatching(/\d{2}:\d{2}$/)])
  expect(await cells('TKT-002')).toStrictEqual(['Hỏi cách nạp thêm creditTKT-002 · Kiều Anh Tuấn', 'Công ty CP Giao nhận Phương Nam', 'Thanh toán', 'Đã đóng', expect.stringMatching(/\d{2}:\d{2}$/)])

  await user.click(screen.getByRole('combobox', { name: 'Trạng thái' }))
  await user.click(await screen.findByRole('option', { name: 'Đã đóng' }))
  await waitFor(() => expect(screen.getByLabelText('url')).toHaveTextContent('trang-thai=CLOSED'))
  expect(screen.queryByText('Planner tải chậm với phương án nhiều kiện')).not.toBeInTheDocument()
  expect(screen.getByText('Hỏi cách nạp thêm credit')).toBeInTheDocument()
})

test('replying starts the ticket, and its status can be changed to closed and back', async () => {
  const user = userEvent.setup()
  renderSupport('?ticket=TKT-001')
  const thread = await screen.findByRole('region', { name: 'Planner tải chậm với phương án nhiều kiện' }, SLOW)
  expect(within(thread).getByText('Chưa có trả lời.')).toBeInTheDocument()

  await user.type(within(thread).getByRole('textbox', { name: 'Trả lời' }), 'Bạn dùng bản Chrome nào?')
  await user.click(within(thread).getByRole('button', { name: 'Gửi trả lời' }))
  const answer = await within(thread).findByText('Bạn dùng bản Chrome nào?', {}, SLOW)
  expect(answer.closest('li')).toHaveTextContent('Tạ Thị Ngọc Ánh · Hỗ trợ khách hàng')
  // Trả lời yêu cầu Mở thì yêu cầu sang Đang xử lý (cả ô trạng thái lẫn dòng trong bảng)
  await waitFor(() => expect(within(thread).getByRole('combobox', { name: 'Trạng thái yêu cầu' })).toHaveTextContent('Đang xử lý'))
  expect((await rowOf('TKT-001')).textContent).toContain('Đang xử lý')

  await user.click(within(thread).getByRole('combobox', { name: 'Trạng thái yêu cầu' }))
  await user.click(await screen.findByRole('option', { name: 'Đã đóng' }))
  expect(await within(thread).findByText('Yêu cầu đã đóng. Mở lại để trả lời tiếp.', {}, SLOW)).toBeInTheDocument()
  expect(within(thread).queryByRole('textbox', { name: 'Trả lời' })).not.toBeInTheDocument()
  expect((await rowOf('TKT-001')).textContent).toContain('Đã đóng')

  await user.click(within(thread).getByRole('combobox', { name: 'Trạng thái yêu cầu' }))
  await user.click(await screen.findByRole('option', { name: 'Mở' }))
  expect(await within(thread).findByRole('textbox', { name: 'Trả lời' }, SLOW)).toBeInTheDocument()
})

test('the side panel shows the plan, the balance and the latest credit transactions of the company of the open ticket, read only', async () => {
  renderSupport('?ticket=TKT-002')
  const panel = await screen.findByRole('region', { name: 'Thông tin công ty' }, SLOW)
  await within(panel).findByText('Basic · Basic', {}, SLOW)
  expect(within(panel).getByText('Công ty CP Giao nhận Phương Nam')).toBeInTheDocument()
  expect(within(panel).getByText('Đang hoạt động')).toBeInTheDocument()
  // Phương Nam đã dùng gần hết 100 credit của gói Basic: còn 2, và hơn 20 giao dịch nên khung chỉ giữ 20 dòng mới nhất
  expect(within(panel).getByText('Số dư credit').nextElementSibling).toHaveTextContent('2')
  expect(within(panel).getAllByRole('listitem')).toHaveLength(20)
  expect(within(panel).getAllByRole('listitem')[0]).toHaveTextContent('Dùng')
  expect(within(panel).getByText('Chỉ đọc')).toBeInTheDocument()
  expect(within(panel).queryByRole('button')).not.toBeInTheDocument()
  // Cuộc trao đổi của yêu cầu đã đóng: hai lần trả lời của seed, không có ô trả lời
  const thread = screen.getByRole('region', { name: 'Hỏi cách nạp thêm credit' })
  expect(within(thread).getAllByRole('listitem')).toHaveLength(2)
})
