import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { DeadlineStatus } from '@/domain/routing'
import { createFormatter } from '@/lib/format'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb, type Trip } from '@/lib/mock-db'
import { LOAD, renderDriver } from './driver-test-utils'
import { StopEta } from './StopEta'

/**
 * Giờ đến và hạn giao trong thẻ liên hệ của màn điểm giao (`StopEta`, FE-6-09). Phần lớn dựng thẳng component với chuyến viết tay — giờ
 * và mức hạn là của kho, màn chỉ nói lại; bài cuối đi qua kho dùng chung → `driver-api.ts` → màn tài xế để kiểm giờ đến tính từ vị trí
 * xe mô phỏng. Chỉ giả `Date` (giờ của kho ở tốc độ 1 là giờ máy); độ trễ giả của kho vẫn chạy thật.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

const STOP = { id: 'STOP-01', name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An' }
// 16/09/2026 giờ Việt Nam: dự kiến 08:15, hạn 08:50 — kịp hạn (đến trước hạn hơn 30 phút)
const ETA = '2026-09-16T01:15:42.288Z'
const DEADLINE = '2026-09-16T01:50:00.000Z'

function tripWith({ eta, deadline, status }: { eta?: string; deadline?: string; status?: DeadlineStatus }): Pick<Trip, 'id' | 'stops' | 'routePlan'> {
  return {
    id: 'TRIP-ETA',
    stops: [{ ...STOP, ...(deadline === undefined ? {} : { deadline }) }],
    ...(eta === undefined ? {} : {
      routePlan: {
        stops: [{ stopId: STOP.id, eta, ...(status === undefined ? {} : { deadlineStatus: status }) }],
        missedStopIds: [], totalKm: 12.3, totalMinutes: 16, optimizedAt: '2026-09-15T09:00:00.000Z', optimizedBy: 'US-0001', isMockResult: true,
      },
    }),
  }
}

function renderEta(props: ComponentProps<typeof StopEta>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = (next: ComponentProps<typeof StopEta>) => (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <StopEta {...next} />
      </I18nProvider>
    </QueryClientProvider>
  )
  const view = render(ui(props))
  return { ...view, rerenderEta: (next: ComponentProps<typeof StopEta>) => view.rerender(ui(next)) }
}

/** Giá trị của một dòng giờ (`<dd>` ngay sau nhãn). */
function fact(label: string) {
  return screen.getByText(label, { selector: 'dt' }).nextElementSibling
}

test('before arriving: the expected arrival from the optimised route, the deadline with its status in words, the source and MOCK RESULT', () => {
  vi.setSystemTime('2026-09-16T00:30:00.000Z')
  renderEta({ trip: tripWith({ eta: ETA, deadline: DEADLINE, status: 'OK' }), stopNumber: 1, arrivedAt: undefined, delivering: false })
  expect(fact('Dự kiến đến')).toHaveTextContent(/^08:15$/)
  expect(fact('Hạn giao')).toHaveTextContent(/^08:50Kịp hạn$/)
  const source = screen.getByText('Theo kế hoạch tuyến')
  expect(within(source).getByText('MOCK RESULT')).toBeInTheDocument()
  expect(screen.queryByText('Đã đến')).not.toBeInTheDocument()
})

test('a stop without a deadline says so and has no deadline status; the expected arrival stays', () => {
  vi.setSystemTime('2026-09-16T00:30:00.000Z')
  renderEta({ trip: tripWith({ eta: ETA }), stopNumber: 1, arrivedAt: undefined, delivering: false })
  expect(fact('Dự kiến đến')).toHaveTextContent(/^08:15$/)
  expect(fact('Hạn giao')).toHaveTextContent(/^Không có hạn$/)
})

test('a trip whose route was never optimised has no expected arrival, no source and no MOCK RESULT — only the deadline', () => {
  vi.setSystemTime('2026-09-16T00:30:00.000Z')
  renderEta({ trip: tripWith({ deadline: DEADLINE }), stopNumber: 1, arrivedAt: undefined, delivering: true })
  expect(screen.queryByText('Dự kiến đến')).not.toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(screen.queryByText('Theo kế hoạch tuyến')).not.toBeInTheDocument()
  expect(fact('Hạn giao')).toHaveTextContent(/^08:50$/)
})

test('after arriving: the actual time and whether it was in time — at the deadline is on time, a minute later is late', () => {
  vi.setSystemTime('2026-09-16T02:00:00.000Z')
  const trip = tripWith({ eta: ETA, deadline: DEADLINE, status: 'OK' })
  const { rerenderEta } = renderEta({ trip, stopNumber: 1, arrivedAt: DEADLINE, delivering: true })
  expect(fact('Đã đến')).toHaveTextContent(/^08:50$/)
  expect(fact('Hạn giao')).toHaveTextContent(/^08:50Đến kịp hạn$/)
  // Đã đến thì không còn giờ dự kiến, nguồn hay MOCK RESULT: giờ đến là giờ tài xế bấm
  expect(screen.queryByText('Dự kiến đến')).not.toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()

  rerenderEta({ trip, stopNumber: 1, arrivedAt: '2026-09-16T01:51:00.000Z', delivering: true })
  expect(fact('Đã đến')).toHaveTextContent(/^08:51$/)
  expect(fact('Hạn giao')).toHaveTextContent(/^08:50Đến trễ hạn$/)

  rerenderEta({ trip: tripWith({ eta: ETA }), stopNumber: 1, arrivedAt: '2026-09-16T01:51:00.000Z', delivering: true })
  expect(fact('Hạn giao')).toHaveTextContent(/^Không có hạn$/)
})

test('a time on another day carries its date; a late status is said in words', () => {
  vi.setSystemTime('2026-09-16T00:30:00.000Z')
  const trip = tripWith({ eta: '2026-09-17T02:40:00.000Z', deadline: '2026-09-17T02:30:00.000Z', status: 'MISSED' })
  renderEta({ trip, stopNumber: 1, arrivedAt: undefined, delivering: false })
  expect(fact('Dự kiến đến')).toHaveTextContent(/^09:40 · 17\/09$/)
  expect(fact('Hạn giao')).toHaveTextContent(/^09:30 · 17\/09Trễ hạn dự kiến$/)
})

test('in transit the expected arrival is worked out from where the simulated vehicle is, not from the plan', async () => {
  // TRIP-010 (seed) của tài xế demo: Xếp xong — chờ xuất phát, tuyến đã tối ưu, điểm không có hạn. Xe rời kho lúc 08:30 thay vì 08:00
  // của kế hoạch: chặng Kho Long Bình → Bách Hoá Xanh Thủ Đức mất 1.490.848 ms (tính tay ở `tracking.test.ts`) nên tới 08:54
  vi.setSystemTime('2026-09-14T01:30:00.000Z')
  const db = getMockDb()
  const planned = (await db.getTrip('TRIP-010')).routePlan?.stops[0]?.eta ?? ''
  const first = renderDriver('/tai-xe/diem-giao?chuyen=TRIP-010')
  await screen.findByRole('heading', { level: 1, name: 'Điểm 1 / 3' }, LOAD)
  expect(fact('Dự kiến đến')).toHaveTextContent(new RegExp(`^${createFormatter('vi-VN').time(planned)}$`))
  expect(fact('Hạn giao')).toHaveTextContent(/^Không có hạn$/)
  expect(screen.getByText('Theo kế hoạch tuyến')).toBeInTheDocument()
  first.unmount()

  db.restoreSession('US-0004')
  await db.startDelivery('TRIP-010')
  renderDriver('/tai-xe/diem-giao?chuyen=TRIP-010')
  const source = await screen.findByText('Theo vị trí xe mô phỏng', {}, LOAD)
  expect(within(source).getByText('MOCK RESULT')).toBeInTheDocument()
  expect(fact('Dự kiến đến')).toHaveTextContent(/^08:54$/)
  expect(screen.queryByText('Theo kế hoạch tuyến')).not.toBeInTheDocument()
}, 15_000)
