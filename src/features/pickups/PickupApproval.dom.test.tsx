import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PickupRequestsCard } from './PickupRequestsCard'

/**
 * Duyệt và từ chối yêu cầu nhận hàng (FE-7-04) trên kho mock thật, cùng chuyến `TRIP-009` và cùng đồng hồ với
 * `PickupRequestsCard.dom.test.tsx`. Luật của kho (kiểm lại mười luật, tạo kiện, chèn điểm) kiểm ở `pickup-approval.test.ts`; ở đây chỉ
 * kiểm hộp thoại nối đúng kho và nói đúng điều đã xảy ra.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T05:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const SLOW = { timeout: 8000 }
const STOPS = [
  { id: 'STOP-01', name: 'Siêu thị Co.opmart Bình Dương' },
  { id: 'STOP-02', name: 'Nhà sách Phương Nam Thủ Dầu Một' },
  { id: 'STOP-03', name: 'Bếp ăn công nghiệp KCN Sóng Thần' },
]

function renderCard(role: Role) {
  signedInAs(role)
  return render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <PickupRequestsCard tripId="TRIP-009" phase="delivering" stops={STOPS} />
            <Toaster />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
}

const itemOf = async (id: string) => {
  const card = within(await screen.findByRole('region', { name: 'Nhận hàng dọc đường' }, SLOW))
  return (await card.findByText(id, undefined, SLOW)).closest('li') as HTMLElement
}

test('rejecting needs a reason; the request shows as rejected with it and the card keeps no approve button for it', async () => {
  const user = userEvent.setup()
  renderCard('dispatcher')
  const item = within(await itemOf('PKR-001'))
  await user.click(item.getByRole('button', { name: 'Từ chối yêu cầu PKR-001' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối yêu cầu PKR-001' }))
  await user.click(dialog.getByRole('button', { name: 'Từ chối yêu cầu' }))
  expect(await dialog.findByText('Cần ghi lý do từ chối.')).toBeInTheDocument()
  await user.type(dialog.getByLabelText(/Lý do từ chối/), 'Xe không còn chỗ')
  await user.click(dialog.getByRole('button', { name: 'Từ chối yêu cầu' }))

  const rejected = within(await itemOf('PKR-001'))
  await rejected.findByText('Đã từ chối', undefined, SLOW)
  expect(rejected.getByText('Lý do từ chối: Xe không còn chỗ')).toBeInTheDocument()
  expect(rejected.queryByRole('button', { name: 'Duyệt yêu cầu PKR-001' })).not.toBeInTheDocument()
})

test('approving a request with a failed rule asks for the override reason, then shows the QR packages and the link to print their labels', async () => {
  const user = userEvent.setup()
  const db = getMockDb()
  db.restoreSession('US-0001')
  const seed = (await db.listPickupRequests('TRIP-009'))[0]
  if (!seed) throw new Error('seed phải có một yêu cầu')
  await db.createPickupRequest('TRIP-009', { pickup: seed.pickup, delivery: seed.delivery, packages: [{ ...seed.packages[0]!, packageCode: 'HG-0777', handlingClass: 'FRAGILE' }] })
  renderCard('dispatcher')
  const item = within(await itemOf('PKR-002'))
  await user.click(item.getByRole('button', { name: 'Duyệt yêu cầu PKR-002' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Duyệt yêu cầu PKR-002' }))
  // Mở hộp là kiểm lại mười luật: kiện dễ vỡ trên chuyến chở hàng thường trượt luật 8 nên cần lý do
  expect(await dialog.findByText('1 luật chưa đạt. Muốn duyệt vẫn phải ghi lý do vượt luật.', undefined, SLOW)).toBeInTheDocument()
  expect(dialog.getAllByRole('listitem')).toHaveLength(10)
  // Nút Duyệt mờ cho tới khi kho kiểm xong lần kiểm lại
  await waitFor(() => expect(dialog.getByRole('button', { name: 'Duyệt yêu cầu' })).toBeEnabled(), SLOW)
  await user.click(dialog.getByRole('button', { name: 'Duyệt yêu cầu' }))
  expect(await dialog.findByText('Cần ghi lý do để duyệt khi còn luật không đạt.')).toBeInTheDocument()
  await user.type(dialog.getByLabelText(/Lý do vượt luật/), 'Khách quen, xe còn chỗ')
  await user.click(dialog.getByRole('button', { name: 'Duyệt yêu cầu' }))

  const done = within(await screen.findByRole('dialog', { name: 'Đã duyệt yêu cầu PKR-002' }, SLOW))
  const packageRow = done.getByRole('listitem')
  expect(packageRow).toHaveTextContent(/^PK-\d{4}HG-0777 · mã QR LM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
  const label = done.getByRole('link', { name: 'In nhãn gửi bên gửi' })
  expect(label).toHaveAttribute('href', `/kien-hang/nhan?kien=${packageRow.textContent?.slice(0, 7)}`)
})

test('the manager sees a request still waiting and the reason it cannot decide, but no approve or reject button', async () => {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const seed = (await db.listPickupRequests('TRIP-009'))[0]
  if (!seed) throw new Error('seed phải có một yêu cầu')
  await db.createPickupRequest('TRIP-009', { pickup: seed.pickup, delivery: seed.delivery, packages: [{ ...seed.packages[0]!, handlingClass: 'FRAGILE' }] })
  renderCard('manager')
  const item = within(await itemOf('PKR-003'))
  expect(item.getByText('Chờ duyệt')).toBeInTheDocument()
  expect(item.queryByRole('button', { name: /Duyệt yêu cầu|Từ chối yêu cầu/ })).not.toBeInTheDocument()
  expect(screen.getByText('Chỉ điều phối viên duyệt hoặc từ chối yêu cầu nhận hàng.')).toBeInTheDocument()
})
