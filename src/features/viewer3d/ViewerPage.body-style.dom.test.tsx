import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, expect, test, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { getMockDb } from '@/lib/mock-db'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { ViewerPage } from './ViewerPage'

/**
 * Planner nhận kiểu thân xe theo **loại đang gắn với xe** lúc mở, không theo phương án: kho → `vehicle-types-api.ts` → hook →
 * `SceneCanvas`. Canvas được thay bằng một thẻ ghi lại prop (jsdom không dựng WebGL); thẻ xe ở góc khung đọc cùng giá trị.
 */
vi.mock('./scene/SceneCanvas', () => ({
  SceneCanvas: ({ vehicleBodyStyle }: { vehicleBodyStyle?: string }) => (
    <output aria-label="scene" data-body-style={vehicleBodyStyle ?? 'AUTO'} />
  ),
}))

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

const TRIP = 'TRIP-2026-0914'
const LOAD = { timeout: 8000 }

function renderPlanner() {
  signedInAs('dispatcher')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
          <MemoryRouter initialEntries={[`/chuyen/${TRIP}/phuong-an`]}>
            <Routes>
              <Route path="/chuyen/:tripId/phuong-an" element={<ViewerPage />} />
            </Routes>
          </MemoryRouter>
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

/** Loại xe đang gắn với xe của chuyến chính. */
async function typeOfTripVehicle() {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const { vehicleId } = await db.getTrip(TRIP)
  const typeId = (await db.listVehicleTypeAssignments()).find((item) => item.vehicleId === vehicleId)?.vehicleTypeId
  if (!typeId) throw new Error(`Xe ${vehicleId} của ${TRIP} chưa gắn loại xe`)
  return { db, type: await db.getVehicleType(typeId) }
}

beforeAll(async () => {
  // Kho mặc định không có kiểu thân nào: dáng tự chọn theo kích thước
  const { type } = await typeOfTripVehicle()
  expect(type.bodyStyle).toBeUndefined()
})

test('a vehicle type without a body style leaves the shape to the 3D view, and the vehicle card has no body style row', async () => {
  renderPlanner()
  expect(await screen.findByRole('status', { name: 'scene' }, LOAD)).toHaveAttribute('data-body-style', 'AUTO')
  await userEvent.click(screen.getByRole('button', { name: /^Xe của chuyến: / }))
  expect(within(screen.getByRole('dialog', { name: 'Xe của chuyến' })).queryByText('Kiểu thân xe')).toBeNull()
}, 20_000)

test('the body style declared on the vehicle type reaches the scene and the vehicle card of the Planner', async () => {
  const { db, type } = await typeOfTripVehicle()
  await db.updateVehicleType(type.id, { ...type, bodyStyle: 'VAN_MID' })
  renderPlanner()
  expect(await screen.findByRole('status', { name: 'scene' }, LOAD)).toHaveAttribute('data-body-style', 'VAN_MID')
  await userEvent.click(screen.getByRole('button', { name: /^Xe của chuyến: / }))
  expect(within(screen.getByRole('dialog', { name: 'Xe của chuyến' })).getByText('Van cỡ trung')).toBeInTheDocument()
}, 20_000)
