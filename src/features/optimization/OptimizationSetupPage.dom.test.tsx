import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import type { CargoPackage } from '@/domain/models'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { OptimizationSetupPage } from './OptimizationSetupPage'

const TRIP_ID = 'TRIP-2026-0914'

/** Seam: kho dùng chung → `optimization-api.ts` → hook → màn hình, không giả lập module nào. */
function renderSetup(client = new QueryClient({ defaultOptions: { queries: { retry: false } } }), tripId = TRIP_ID) {
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/chuyen/${tripId}/toi-uu`]}>
          <Routes><Route path="/chuyen/:tripId/toi-uu" element={<OptimizationSetupPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('the seed trip is ready to optimize, and the screen never says "AI"', async () => {
  renderSetup()
  expect(await screen.findByText('Không có lỗi — có thể tối ưu.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeEnabled()
  expect(document.body.textContent ?? '').not.toMatch(/\bAI\b/)
})

test('the run history lists every run newest first, the failed one with its reason (LM-104)', async () => {
  renderSetup()
  const history = within(await screen.findByRole('region', { name: 'Lần chạy tối ưu' }))
  const rows = await history.findAllByRole('row')
  expect(rows).toHaveLength(3)
  expect(rows[1]).toHaveTextContent('RUN-002')
  expect(rows[1]).toHaveTextContent('Đã duyệt')
  expect(within(rows[1] as HTMLElement).getByRole('link', { name: 'Mở phương án REV-001 trong Planner' })).toBeInTheDocument()
  expect(rows[2]).toHaveTextContent('Cân bằng tải trục')
  expect(rows[2]).toHaveTextContent('Dịch vụ tối ưu không phản hồi')
})

test('a package with no usable orientation disables Optimize and the summary links to exactly that package', async () => {
  const db = getMockDb()
  const trip = await db.getTrip(TRIP_ID)
  const source = trip.packages[0] as CargoPackage
  const broken: CargoPackage = { ...source, id: 'PKG-900', allowedOrientations: ['HWL'], keepUpright: true }
  await db.updateTrip(TRIP_ID, { packages: [...trip.packages, broken] })

  renderSetup()
  const summary = within(await screen.findByRole('region', { name: 'Kiểm tra trước khi tối ưu' }))
  const link = await summary.findByRole('link', { name: /PKG-900/ })
  expect(link).toHaveAttribute('href', `/chuyen/${TRIP_ID}?kien=PKG-900`)
  expect(summary.getAllByRole('link')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeDisabled()

  await db.updateTrip(TRIP_ID, { packages: trip.packages })
})

test('fixing the cargo and coming back enables Optimize without touching the settings (LM-054)', async () => {
  const db = getMockDb()
  const trip = await db.getTrip(TRIP_ID)
  const source = trip.packages[0] as CargoPackage
  const broken: CargoPackage = { ...source, id: 'PKG-901', allowedOrientations: ['HWL'], keepUpright: true }
  await db.updateTrip(TRIP_ID, { packages: [...trip.packages, broken] })

  // Cùng QueryClient như app: lần mở lại đọc bản cache còn lỗi trước, rồi mới nhận dữ liệu đã sửa
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const first = renderSetup(client)
  expect(await screen.findByRole('link', { name: /PKG-901/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeDisabled()
  first.unmount()

  await db.updateTrip(TRIP_ID, { packages: trip.packages })
  void client.invalidateQueries({ queryKey: ['trips', TRIP_ID] })
  renderSetup(client)
  expect(await screen.findByText('Không có lỗi — có thể tối ưu.')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeEnabled())
})

test('a trip the warehouse is loading cannot be optimized again: the banner says why and nothing can be changed (D-45)', async () => {
  renderSetup(undefined, 'TRIP-011')
  expect(await screen.findByText('Kho đang xếp hàng theo phương án đã duyệt nên xe, điểm giao và kiện đã khoá.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tối ưu' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Xe chở chuyến này' })).toBeDisabled()
})

test('a vehicle under maintenance is listed with the reason but cannot be chosen (D-53)', async () => {
  renderSetup()
  const select = await screen.findByRole('combobox', { name: 'Xe chở chuyến này' })
  expect(within(select).getByRole('option', { name: 'Hyundai Mighty EX8 · 50H-118.29 · đang bảo dưỡng' })).toBeDisabled()
  expect(within(select).getByRole('option', { name: 'Truck 6m' })).toBeEnabled()
})
