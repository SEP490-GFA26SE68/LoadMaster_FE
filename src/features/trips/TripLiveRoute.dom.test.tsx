import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { TripDetailPage } from './TripDetailPage'

/**
 * Vị trí xe và giờ đến tính từ vị trí ở Chi tiết chuyến (FE-6-08, FE-6-09), trên kho mock thật. Đồng hồ chỉ giả `Date`: 12:00 ngày neo
 * 14/09/2026. Chuyến seed `TRIP-009` rời kho 06:25:30, xong điểm 1 lúc 07:35:30; xe mô phỏng tới điểm 2 lúc 07:39:06 và đứng chờ tài xế
 * hoàn tất điểm, nên điểm 3 tính từ bây giờ: 12:00 + 1.353.659 ms = 12:22:33 (số đã kiểm ở `tracking.test.ts`).
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-14T05:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

const SLOW = { timeout: 8000 }

function renderTrip(tripId: string, role: Role) {
  signedInAs(role)
  const router = createMemoryRouter([{ path: '/chuyen/:tripId', element: <TripDetailPage /> }], { initialEntries: [`/chuyen/${tripId}`] })
  return render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
}

const stopItems = () => within(screen.getByRole('list', { name: /^Kho xuất phát rồi/ })).getAllByRole('listitem').slice(1)

test.each(['dispatcher', 'companyManager'] as const)('a trip in transit shows the %s where the vehicle is, labelled as simulated, and arrival times from that position', async (role) => {
  const { container } = renderTrip('TRIP-009', role)
  const bar = within(await screen.findByRole('status', { name: 'Vị trí xe' }, SLOW))
  expect(bar.getByText('Mô phỏng')).toBeInTheDocument()
  expect(bar.getByText('Lúc 12:00 · đang dừng')).toBeInTheDocument()
  expect(bar.getByText('MOCK RESULT')).toBeInTheDocument()

  // Bản đồ có mốc xe; danh sách cho trình đọc màn hình nói tên xe kèm nguồn của vị trí
  const map = within(screen.getByRole('region', { name: 'Bản đồ tuyến TRIP-009' }))
  expect(container.querySelector('[data-marker="vehicle"]')).not.toBeNull()
  expect(map.getByText('Vị trí xe: Thaco Ollin 720 · 61C-339.05 (Mô phỏng)')).toBeInTheDocument()

  // Điểm 1 đã giao: không còn giờ đến. Điểm 2: giờ tài xế bấm "Đã đến" trong seed (FE-6-06). Điểm 3: tính từ vị trí xe
  const [first, second, third] = stopItems()
  expect(first).toHaveTextContent('Đã giao 07:35')
  expect(first).not.toHaveTextContent('Dự kiến đến')
  expect(second).toHaveTextContent('Xe đến lúc 08:20 14/09')
  expect(third).toHaveTextContent('Dự kiến đến 12:22 14/09')
})

test('a trip that has not left, or has finished, shows no vehicle', async () => {
  const planned = renderTrip('TRIP-2026-0914', 'dispatcher')
  await screen.findByRole('region', { name: 'Bản đồ tuyến TRIP-2026-0914' }, SLOW)
  expect(screen.queryByRole('status', { name: 'Vị trí xe' })).not.toBeInTheDocument()
  expect(planned.container.querySelector('[data-marker="vehicle"]')).toBeNull()
  planned.unmount()

  const finished = renderTrip('TRIP-008', 'dispatcher')
  await screen.findByRole('region', { name: 'Bản đồ tuyến TRIP-008' }, SLOW)
  expect(screen.queryByRole('status', { name: 'Vị trí xe' })).not.toBeInTheDocument()
  expect(finished.container.querySelector('[data-marker="vehicle"]')).toBeNull()
  expect(stopItems().map((item) => /Dự kiến đến|Xe đến lúc/.test(item.textContent ?? ''))).toStrictEqual([false, false, false, false])
})
