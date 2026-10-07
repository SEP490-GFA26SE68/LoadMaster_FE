import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import type { PickupRuleResult } from '@/domain/pickup'
import { I18nProvider } from '@/lib/i18n'
import type { TripPhase } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PickupRequestsCard } from './PickupRequestsCard'
import { PickupRulesList } from './PickupRulesList'

/**
 * Hộp "Nhận hàng dọc đường" và thẻ yêu cầu của chuyến (FE-7-03) trên kho mock thật. Đồng hồ chỉ giả `Date` về 12:00 ngày neo 14/09/2026:
 * `TRIP-009` đang vận chuyển, xe đứng ở điểm 2 (số đã kiểm ở `pickups.test.ts`: yêu cầu một kiện thường 12 kg đạt cả mười luật). Mười luật tự
 * nó kiểm ở `pickup-rules.test.ts`; ở đây chỉ kiểm màn nối đúng kho.
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

function renderCard(role: Role, phase: TripPhase = 'delivering') {
  signedInAs(role)
  return render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <PickupRequestsCard tripId="TRIP-009" phase={phase} stops={STOPS} />
            <Toaster />
          </MemoryRouter>
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
}

test('the dispatcher sends a request, sees the ten rules with the estimated ones labelled, and finds it in the card', async () => {
  const user = userEvent.setup()
  renderCard('dispatcher')
  const card = within(await screen.findByRole('region', { name: 'Nhận hàng dọc đường' }, SLOW))
  expect(await card.findByText('PKR-001', undefined, SLOW)).toBeInTheDocument()
  expect(card.getByText('Chưa kiểm luật')).toBeInTheDocument()

  await user.click(card.getByRole('button', { name: 'Nhận hàng dọc đường' }))
  const dialog = within(await screen.findByRole('dialog', { name: /Nhận hàng dọc đường — chuyến TRIP-009/ }))
  const [pickup, delivery] = [dialog.getByRole('group', { name: 'Điểm nhận hàng' }), dialog.getByRole('group', { name: 'Điểm giao hàng' })]
  await user.type(within(pickup).getByLabelText(/Tên điểm/), 'Xưởng may Hoàng Gia')
  await user.type(within(pickup).getByLabelText(/Địa chỉ/), 'Đường số 4, KCN VSIP 1, Thuận An')
  await user.type(within(pickup).getByLabelText('Vĩ độ'), '10.928')
  await user.type(within(pickup).getByLabelText('Kinh độ'), '106.712')
  await user.type(within(delivery).getByLabelText(/Tên điểm/), 'Bếp ăn KCN Sóng Thần')
  await user.type(within(delivery).getByLabelText(/Địa chỉ/), '12 Đường số 6, KCN Sóng Thần 1, Dĩ An')
  await user.type(within(delivery).getByLabelText('Vĩ độ'), '10.893')
  await user.type(within(delivery).getByLabelText('Kinh độ'), '106.75')
  const row = within(dialog.getByRole('group', { name: 'Kiện 1' }))
  await user.type(row.getByLabelText(/Mã của bên gửi/), 'HG-0601')
  await user.type(row.getByLabelText(/Dài/), '60')
  await user.type(row.getByLabelText(/Rộng/), '40')
  await user.type(row.getByLabelText(/Cao/), '40')
  await user.type(row.getByLabelText(/Khối lượng/), '12')
  await user.click(dialog.getByRole('button', { name: 'Gửi yêu cầu' }))

  // Kết quả của mười luật ngay sau khi lưu: đạt cả mười — chữ, không chỉ màu; luật ước lượng có nhãn
  const result = within(await screen.findByRole('dialog', { name: /Yêu cầu PKR-002/ }, SLOW))
  const rules = within(result.getByRole('list', { name: 'Mười luật nhận hàng' })).getAllByRole('listitem')
  expect(rules).toHaveLength(10)
  expect(rules.filter((item) => item.getAttribute('data-passed') === 'false').map((item) => item.getAttribute('data-rule'))).toStrictEqual([])
  expect(rules[5]).not.toHaveTextContent('Không đạt')
  expect(rules[5]).toHaveTextContent('Ước lượng')
  expect(rules[0]).toHaveTextContent('Điểm nhận cách tuyến')
  expect(rules[1]).toHaveTextContent('không vượt điểm 3 (Bếp ăn công nghiệp KCN Sóng Thần)')
  expect(result.getByText('Đạt cả mười luật. Điều phối viên có thể duyệt ngay.')).toBeInTheDocument()

  await user.click(result.getByRole('button', { name: 'Đóng' }))
  const request = await within(await screen.findByRole('region', { name: 'Nhận hàng dọc đường' })).findByText('PKR-002', undefined, SLOW)
  expect(request.closest('li')).toHaveTextContent('10 / 10 luật đạt')
  expect(request.closest('li')).toHaveTextContent('Đạt mười luật — chờ duyệt')
})

test('a form with nothing filled in is refused in place and sends nothing; a trip no longer in transit dims the button with its reason', async () => {
  const user = userEvent.setup()
  const { unmount } = renderCard('dispatcher')
  const card = within(await screen.findByRole('region', { name: 'Nhận hàng dọc đường' }, SLOW))
  await user.click(card.getByRole('button', { name: 'Nhận hàng dọc đường' }))
  const dialog = within(await screen.findByRole('dialog', { name: /Nhận hàng dọc đường — chuyến TRIP-009/ }))
  await user.click(dialog.getByRole('button', { name: 'Gửi yêu cầu' }))
  expect((await dialog.findAllByText('Cần nhập.')).length).toBeGreaterThanOrEqual(5)
  expect(dialog.getAllByText('Cần chọn toạ độ.')).toHaveLength(2)
  expect(dialog.getAllByText('Cần là số lớn hơn 0.')).toHaveLength(4)
  expect(screen.queryByRole('dialog', { name: /Yêu cầu PKR-/ })).not.toBeInTheDocument()
  unmount()

  renderCard('dispatcher', 'completed')
  const done = within(await screen.findByRole('region', { name: 'Nhận hàng dọc đường' }, SLOW))
  const button = done.getByRole('button', { name: 'Nhận hàng dọc đường' })
  expect(button).toBeDisabled()
  expect(button).toHaveAccessibleDescription('Chỉ tạo được yêu cầu nhận hàng khi chuyến đang vận chuyển.')
})

test('the manager reads the requests but has no button to send one', async () => {
  renderCard('manager')
  const card = within(await screen.findByRole('region', { name: 'Nhận hàng dọc đường' }, SLOW))
  expect(await card.findByText('PKR-001', undefined, SLOW)).toBeInTheDocument()
  expect(card.queryByRole('button', { name: 'Nhận hàng dọc đường' })).not.toBeInTheDocument()
})

test('the rules list says pass or fail in words, tags the estimated rules and writes each reason from its code and parameters', () => {
  const results: PickupRuleResult[] = [
    { rule: 1, passed: false, code: 'PICKUP_OFF_ROUTE', params: { distanceKm: 12.34, maxKm: 10 }, estimated: false },
    { rule: 3, passed: true, code: 'PICKUP_PAYLOAD_OK', params: { totalKg: 2262, maxPayloadKg: 7000, overKg: 0 }, estimated: false },
    { rule: 6, passed: false, code: 'PICKUP_COG_OFF_CENTER', params: { reasons: 'COG_LONGITUDINAL,COG_HIGH' }, estimated: true },
  ]
  render(<I18nProvider><PickupRulesList results={results} stopLabel={(id) => id} /></I18nProvider>)
  const items = screen.getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Không đạt')
  expect(items[0]).toHaveTextContent('Điểm nhận cách tuyến 12,3 km, quá mức tối đa 10 km.')
  expect(items[0]).not.toHaveTextContent('Ước lượng')
  expect(items[1]).toHaveTextContent('Đạt')
  expect(items[1]).toHaveTextContent('Tổng tải 2.262 kg, tải trọng tối đa 7.000 kg.')
  expect(items[2]).toHaveTextContent('Ước lượng')
  expect(items[2]).toHaveTextContent('lệch dọc và quá cao')
})
