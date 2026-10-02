import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { twoCartonTrip } from '@/test/mock-db-samples'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { TripDetailPage } from './TripDetailPage'

const SLOW = { timeout: 8000 }

/** Seam: kho seed → `trip-extras-api.ts` / `requirements-api.ts` → hook → Chi tiết chuyến (LM-104 luồng 2, FE-4b-01). */
function renderDetail(tripId: string, role: Role) {
  signedInAs(role)
  const router = createMemoryRouter(
    [
      { path: '/chuyen/:tripId', element: <TripDetailPage /> },
      { path: '/chuyen/:tripId/sua', element: <p>Form sửa chuyến</p> },
      { path: '/yeu-cau-giao', element: <p>Yêu cầu giao</p> },
    ],
    { initialEntries: [`/chuyen/${tripId}`] },
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

test('a draft trip without packages is not ready; putting a requirement on its stop makes it ready and lists the requirement', async () => {
  const trip = await getMockDb().createTrip({ ...twoCartonTrip(), packages: [] })
  const user = renderDetail(trip.id, 'dispatcher')

  const card = within(await screen.findByRole('region', { name: 'Kiểm tra trước khi tối ưu' }, SLOW))
  expect(await card.findByText('Chưa sẵn sàng tối ưu', {}, SLOW)).toBeInTheDocument()
  expect(card.getByText('Chưa có kiện nào')).toBeInTheDocument()
  expect(card.getByText('3 điểm giao chưa có kiện')).toBeInTheDocument()
  expect(card.getByText('1 mục đang chặn tối ưu. Sửa xong rồi chạy tối ưu.')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Yêu cầu giao trên chuyến' })).getByText('Chưa có yêu cầu giao nào trên chuyến này.')).toBeInTheDocument()

  // Lối sửa ngay tại chỗ: đưa yêu cầu giao vào chuyến — chọn yêu cầu chờ, điểm giao trùng tên điểm đến được chọn sẵn
  await user.click(card.getAllByRole('button', { name: 'Đưa yêu cầu vào chuyến' })[0]!)
  const dialog = within(await screen.findByRole('dialog', { name: `Đưa yêu cầu giao vào ${trip.name}` }, SLOW))
  await user.click(await dialog.findByRole('combobox', { name: 'Yêu cầu giao' }, SLOW))
  await user.click(await screen.findByRole('option', { name: /^REQ-006 · Kho Bách Hoá Xanh Dĩ An/ }))
  expect(dialog.getByRole('combobox', { name: 'Điểm giao' })).toHaveTextContent('Điểm 2 · Kho Bách Hoá Xanh Dĩ An')
  await user.click(dialog.getByRole('button', { name: 'Đưa vào chuyến' }))

  expect(await card.findByText('Sẵn sàng tối ưu', {}, SLOW)).toBeInTheDocument()
  expect(card.getByText('10 kiện')).toBeInTheDocument()
  expect(within(await screen.findByRole('region', { name: 'Yêu cầu giao trên chuyến' }, SLOW)).getByText('REQ-006')).toBeInTheDocument()
})

test('the manager sees the check without ways to change the trip', async () => {
  const trip = await getMockDb().createTrip({ ...twoCartonTrip(), packages: [] })
  renderDetail(trip.id, 'manager')

  const card = within(await screen.findByRole('region', { name: 'Kiểm tra trước khi tối ưu' }, SLOW))
  expect(await card.findByText('Chưa sẵn sàng tối ưu', {}, SLOW)).toBeInTheDocument()
  expect(card.queryByRole('button')).toBeNull()
  expect(card.queryByRole('link')).toBeNull()
  expect(screen.queryByRole('region', { name: 'Yêu cầu giao trên chuyến' })).toBeNull()
})
