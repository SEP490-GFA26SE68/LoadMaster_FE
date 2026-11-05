import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import type { StopDelivery } from './driver-plan'
import { DriverStopList } from './DriverStopList'

/**
 * Giờ của từng điểm ở danh sách điểm của màn điểm giao (`DriverStopList`, chuyến có điểm nhận dọc đường). Dựng thẳng danh sách với chuyến
 * viết tay đang vận chuyển — giờ và mức hạn là của kho, màn chỉ nói lại. Bài đọc ngay lần vẽ đầu, khi kho chưa trả vị trí xe: giờ đến dự kiến
 * là của tuyến (giờ tính từ vị trí xe kiểm ở `MyTripStops.dom.test.tsx` và `stop-timing.test.ts`). Chỉ giả `Date`.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime('2026-09-16T01:55:00.000Z')
})

afterEach(() => {
  vi.useRealTimers()
})

const STOPS: Trip['stops'] = [
  { id: 'STOP-01', name: 'Siêu thị Co.opmart Bình Dương', address: 'Thủ Dầu Một' },
  { id: 'STOP-02', name: 'Nhà sách Phương Nam Thủ Dầu Một', address: 'Thủ Dầu Một', deadline: '2026-09-16T01:50:00.000Z' },
  { id: 'STOP-03', name: 'Xưởng may Hoàng Gia', address: 'KCN VSIP 1, Thuận An', kind: 'PICKUP' },
  { id: 'STOP-04', name: 'Bếp ăn công nghiệp KCN Sóng Thần', address: 'Dĩ An', deadline: '2026-09-16T03:00:00.000Z' },
]

const ROUTE: NonNullable<Trip['routePlan']> = {
  stops: [
    { stopId: 'STOP-01', eta: '2026-09-16T00:35:24.680Z' },
    { stopId: 'STOP-02', eta: '2026-09-16T01:06:40.757Z', deadlineStatus: 'OK' },
    { stopId: 'STOP-03', eta: '2026-09-16T02:10:00.000Z' },
    { stopId: 'STOP-04', eta: '2026-09-16T02:40:00.000Z', deadlineStatus: 'OK' },
  ],
  missedStopIds: [], totalKm: 41.2, totalMinutes: 160, optimizedAt: '2026-09-15T09:00:00.000Z', optimizedBy: 'US-0001', isMockResult: true,
}

/** Điểm 1 xong; tài xế bấm "Đã đến" điểm 2 lúc 08:51, sau hạn 08:50. */
const DELIVERY: NonNullable<Trip['delivery']> = {
  startedAt: '2026-09-15T23:50:00.000Z', startedBy: 'US-0006', issues: [],
  stops: [
    { number: 1, unloadedIds: ['PKG-001-01'], arrivedAt: '2026-09-16T00:40:00.000Z', completedAt: '2026-09-16T00:55:00.000Z' },
    { number: 2, unloadedIds: [], arrivedAt: '2026-09-16T01:51:00.000Z' },
    { number: 3, unloadedIds: [] },
    { number: 4, unloadedIds: [] },
  ],
}

const DELIVERIES: StopDelivery[] = STOPS.map((stop, index) => ({ number: index + 1, name: stop.name, address: stop.address, items: [], kind: stop.kind ?? 'DELIVERY' }))

function renderList(routePlan: Trip['routePlan']) {
  const trip = routePlan === undefined ? { id: 'TRIP-ETA', stops: STOPS, delivery: DELIVERY } : { id: 'TRIP-ETA', stops: STOPS, routePlan, delivery: DELIVERY }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <DriverStopList trip={trip} delivering stops={DELIVERIES} currentNumber={2} completedStops={new Set([1])} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return within(screen.getByRole('list', { name: 'Các điểm của chuyến' })).getAllByRole('listitem')
}

test('each stop not yet completed has its time under the name: the reached one when the driver arrived and whether in time, the later ones expected', () => {
  const [done, reached, pickup, last] = renderList(ROUTE)
  expect(done).toHaveTextContent(/^1Siêu thị Co\.opmart Bình DươngĐiểm giao hàngĐã xong$/)
  expect(reached).toHaveTextContent(/Đang ở điểm nàyĐã đến 08:51Đến trễ hạn$/)
  // Điểm nhận không có hạn: giờ đến dự kiến, không có mức hạn
  expect(pickup).toHaveTextContent(/Điểm nhận hàngChưa tớiDự kiến 09:10$/)
  expect(last).toHaveTextContent(/Chưa tớiDự kiến 09:40Kịp hạn$/)
  // Một dòng nguồn cuối danh sách, kèm MOCK RESULT
  const source = screen.getByText('Theo kế hoạch tuyến')
  expect(within(source).getByText('MOCK RESULT')).toBeInTheDocument()
  expect(screen.getAllByText('MOCK RESULT')).toHaveLength(1)
})

test('a trip whose route was never optimised keeps its stop rows without any time, source or MOCK RESULT', () => {
  const rows = renderList(undefined)
  expect(rows.map((row) => row.textContent)).toStrictEqual([
    '1Siêu thị Co.opmart Bình DươngĐiểm giao hàngĐã xong',
    '2Nhà sách Phương Nam Thủ Dầu MộtĐiểm giao hàngĐang ở điểm này',
    '3Xưởng may Hoàng GiaĐiểm nhận hàngChưa tới',
    '4Bếp ăn công nghiệp KCN Sóng ThầnĐiểm giao hàngChưa tới',
  ])
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
})
