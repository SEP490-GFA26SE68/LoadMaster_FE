import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { TripDetailPage } from './TripDetailPage'

/**
 * Đổi xe ở Chi tiết chuyến (FE-5b-08, D-80) trên kho mock thật. Seed: chuyến chính `TRIP-2026-0914` (Đã lập kế hoạch) chở 132 kiện,
 * 5.844 kg, 16,6 m³ trên Hyundai HD210; Hino FC9J đông lạnh (6.000 kg) sẵn sàng và chở được; Truck 6m (5.000 kg) và Hino XZU720
 * (3.500 kg) thiếu tải; Isuzu FVR 900 đang xếp `TRIP-011`; Hyundai Mighty EX8 đang bảo dưỡng. `TRIP-014` là chuyến nháp.
 */
const SLOW = { timeout: 8000 }
const HERO = 'TRIP-2026-0914'

function renderDetail(tripId: string, role: Role = 'dispatcher') {
  signedInAs(role)
  const router = createMemoryRouter([{ path: '/chuyen/:tripId', element: <TripDetailPage /> }, { path: '*', element: <p>Màn khác</p> }], { initialEntries: [`/chuyen/${tripId}`] })
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

const vehicleSection = async () => within(await screen.findByRole('region', { name: 'Phương tiện' }, SLOW))
const row = (dialog: ReturnType<typeof within>, name: RegExp) => dialog.getByRole('radio', { name })

test('a draft trip changes its vehicle in the trip form; a reader has no way to change it', async () => {
  renderDetail('TRIP-014')
  expect((await vehicleSection()).getByRole('link', { name: 'Đổi xe' })).toHaveAttribute('href', '/chuyen/TRIP-014/sua')
  expect(screen.queryByRole('button', { name: 'Đổi xe' })).toBeNull()
})

test('the company manager sees the vehicle of a planned trip without any way to change it', async () => {
  renderDetail(HERO, 'companyManager')
  const section = await vehicleSection()
  expect(section.queryByRole('button', { name: 'Đổi xe' })).toBeNull()
  expect(section.queryByRole('link', { name: 'Đổi xe' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Thao tác' })).toBeNull()
})

test('a planned trip lists every vehicle with why it can or cannot be chosen, changes to a ready one that takes the cargo, and its plan goes stale', async () => {
  const user = renderDetail(HERO)
  await user.click((await vehicleSection()).getByRole('button', { name: 'Đổi xe' }))
  const dialog = within(await screen.findByRole('dialog', { name: `Đổi xe của chuyến ${HERO}` }))
  expect(await dialog.findByText('Hàng của chuyến: 132 kiện · 5.844 kg · 16,6 m³', {}, SLOW)).toBeInTheDocument()

  // Xe chọn được đứng trước: chỉ Hino FC9J vừa sẵn sàng vừa đủ tải
  const radios = dialog.getAllByRole('radio')
  expect(radios.map((radio) => (radio as HTMLButtonElement).disabled)).toStrictEqual([false, true, true, true, true, true, true, true])
  expect(row(dialog, /Hino FC9J đông lạnh/)).toBe(radios[0])
  expect(row(dialog, /Hyundai HD210/)).toHaveAccessibleDescription('Xe đang dùng cho chuyến này.')
  expect(row(dialog, /Truck 6m/)).toHaveAccessibleDescription('Hàng nặng 5.844 kg, vượt tải trọng 5.000 kg.')
  // Xe mẫu khai hai trục (số ước lượng của seed): Hino XZU720 còn nhận 900 + 3.700 kg trên hai nhóm trục
  expect(row(dialog, /Hino XZU720/)).toHaveAccessibleDescription('Hàng nặng 5.844 kg, vượt tải trọng 3.500 kg. Hàng nặng 5.844 kg, hai nhóm trục chỉ nhận thêm được 4.600 kg.')
  expect(row(dialog, /Isuzu FVR 900/)).toHaveAccessibleDescription('Đang phục vụ chuyến TRIP-011.')
  expect(row(dialog, /Hyundai Mighty EX8/)).toHaveAccessibleDescription('Đang bảo dưỡng.')
  // Xe vừa bận vừa thiếu tải nói cả hai lý do
  expect(row(dialog, /Isuzu NQR 550/)).toHaveAccessibleDescription('Đang phục vụ chuyến TRIP-010. Hàng nặng 5.844 kg, vượt tải trọng 5.500 kg.')

  const submit = dialog.getByRole('button', { name: 'Đổi xe' })
  expect(submit).toBeDisabled()
  await user.click(row(dialog, /Hino FC9J đông lạnh/))
  expect(submit).toBeEnabled()
  await user.click(submit)
  expect(await screen.findByText(`Đã đổi xe của chuyến ${HERO}. Phương án xếp hàng hiện tại đã lỗi thời.`, {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

  expect((await getMockDb().getTrip(HERO)).vehicleId).toBe('VEHICLE-004')
  // Chuyến vẫn Đã lập kế hoạch; phương án đã duyệt thành lỗi thời và xe mới hiện ở mục Phương tiện
  expect(await screen.findByText('Lỗi thời — cần tối ưu lại', {}, SLOW)).toBeInTheDocument()
  expect(await (await vehicleSection()).findByText(/Hino FC9J đông lạnh/, {}, SLOW)).toBeInTheDocument()
})

test('the actions menu of a planned trip opens the same dialog', async () => {
  const user = renderDetail('TRIP-012')
  await user.click(await screen.findByRole('button', { name: 'Thao tác' }, SLOW))
  await user.click(await screen.findByRole('menuitem', { name: 'Đổi xe' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Đổi xe của chuyến TRIP-012' }))
  // TRIP-012: 70 kiện, 2.100 kg trên Hino XZU720 — xe sẵn sàng nào của công ty cũng chở được
  expect(await dialog.findByText('Hàng của chuyến: 70 kiện · 2.100 kg · 7,4 m³', {}, SLOW)).toBeInTheDocument()
  expect(row(dialog, /Hino XZU720/)).toHaveAccessibleDescription('Xe đang dùng cho chuyến này.')
  expect(row(dialog, /Truck 6m/)).toBeEnabled()
})
