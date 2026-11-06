import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import type { MyTripRow } from './my-trips'
import { LOAD, renderDriver } from './driver-test-utils'
import { MyTripStops } from './MyTripStops'

/**
 * Giờ của từng điểm ở thẻ "Chuyến của tôi" (`MyTripStops`). Bài đầu đi qua kho dùng chung → `driver-api.ts` → màn: chuyến seed đang chạy, giờ
 * tính từ vị trí xe mô phỏng. Hai bài sau dựng thẳng danh sách với chuyến viết tay — giờ và mức hạn là của kho, màn chỉ nói lại. Chỉ giả
 * `Date` (giờ của kho ở tốc độ 1 là giờ máy); độ trễ giả của kho vẫn chạy thật.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

function stopRows(tripId: string) {
  return within(screen.getByRole('list', { name: `Các điểm của chuyến ${tripId}` })).getAllByRole('listitem')
}

test('in transit: a completed stop keeps its check and no time, the stop the driver reached says when, the next stop is expected from the vehicle position', async () => {
  // TRIP-009 (seed) của Ngô Văn Bảo lúc 12:00: điểm 1 xong, tài xế bấm "Đã đến" điểm 2 lúc 08:20:30 và xe đứng đó từ bấy giờ — quá 15 phút
  // dừng nên điểm 3 tính từ bây giờ: 12:00 + chặng 1.353.659 ms = 12:22:33,659 (tính tay ở `tracking.test.ts`)
  vi.setSystemTime('2026-09-14T05:00:00.000Z')
  renderDriver('/tai-xe', 'US-0006')
  const source = await screen.findByText('Theo vị trí xe mô phỏng', {}, LOAD)
  expect(within(source).getByText('MOCK RESULT')).toBeInTheDocument()
  const [done, arrived, next] = stopRows('TRIP-009')
  expect(within(done as HTMLElement).getByText('Đã xong')).toHaveClass('sr-only')
  expect(done).not.toHaveTextContent(/Dự kiến|Đã đến/)
  expect(arrived).toHaveTextContent(/Đã đến 08:20$/)
  expect(next).toHaveTextContent(/Dự kiến 12:22$/)
  // Một dòng nguồn cho cả danh sách, không phải mỗi điểm một dòng
  expect(screen.getAllByText('MOCK RESULT')).toHaveLength(1)
  expect(screen.queryByText('Theo kế hoạch tuyến')).not.toBeInTheDocument()
}, 15_000)

const STOPS: Trip['stops'] = [
  { id: 'STOP-01', name: 'Bách Hoá Xanh Thủ Đức', address: 'Thủ Đức' },
  { id: 'STOP-02', name: 'MM Mega Market An Phú', address: 'An Phú', deadline: '2026-09-16T01:50:00.000Z' },
  { id: 'STOP-03', name: 'Circle K Phan Xích Long', address: 'Phú Nhuận', deadline: '2026-09-17T02:30:00.000Z' },
]

const ROUTE: NonNullable<Trip['routePlan']> = {
  stops: [
    { stopId: 'STOP-01', eta: '2026-09-16T01:15:42.288Z' },
    { stopId: 'STOP-02', eta: '2026-09-16T01:48:28.525Z', deadlineStatus: 'AT_RISK' },
    { stopId: 'STOP-03', eta: '2026-09-17T02:40:00.000Z', deadlineStatus: 'MISSED' },
  ],
  missedStopIds: ['STOP-03'], totalKm: 32.6, totalMinutes: 1525, optimizedAt: '2026-09-15T09:00:00.000Z', optimizedBy: 'US-0001', isMockResult: true,
}

/** Chuyến viết tay xếp xong chờ xuất phát; `routePlan` vắng là chuyến chưa tối ưu tuyến. */
function loadedRow(routePlan: Trip['routePlan']): Pick<MyTripRow, 'id' | 'status' | 'stops' | 'schedule'> {
  return {
    id: 'TRIP-ETA',
    status: 'LOADING',
    stops: STOPS.map((stop, index) => ({ number: index + 1, name: stop.name, kind: 'DELIVERY', packageCount: 12, done: false })),
    schedule: routePlan === undefined ? { stops: STOPS } : { stops: STOPS, routePlan },
  }
}

function renderStops(row: Pick<MyTripRow, 'id' | 'status' | 'stops' | 'schedule'>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MyTripStops row={row} />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('waiting to depart: every stop expects the time of the route plan, with the deadline status in words only where the stop has a deadline', () => {
  vi.setSystemTime('2026-09-16T00:30:00.000Z')
  renderStops(loadedRow(ROUTE))
  const [first, second, third] = stopRows('TRIP-ETA')
  expect(first).toHaveTextContent(/Bách Hoá Xanh Thủ Đức12 kiệnDự kiến 08:15$/)
  expect(second).toHaveTextContent(/Dự kiến 08:48Sát hạn$/)
  // Giờ của một ngày khác kèm ngày
  expect(third).toHaveTextContent(/Dự kiến 09:40 · 17\/09Trễ hạn dự kiến$/)
  const source = screen.getByText('Theo kế hoạch tuyến')
  expect(within(source).getByText('MOCK RESULT')).toBeInTheDocument()
  expect(screen.getAllByText('MOCK RESULT')).toHaveLength(1)
})

test('a trip whose route was never optimised lists its stops without any time, source or MOCK RESULT', () => {
  vi.setSystemTime('2026-09-16T00:30:00.000Z')
  renderStops(loadedRow(undefined))
  expect(stopRows('TRIP-ETA').map((row) => row.textContent)).toStrictEqual([
    '1Điểm 1 · Bách Hoá Xanh Thủ Đức12 kiện',
    '2Điểm 2 · MM Mega Market An Phú12 kiện',
    '3Điểm 3 · Circle K Phan Xích Long12 kiện',
  ])
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(screen.queryByText('Theo kế hoạch tuyến')).not.toBeInTheDocument()
})
