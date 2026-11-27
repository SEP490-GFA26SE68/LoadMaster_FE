import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { I18nProvider } from '@/lib/i18n'
import { VehicleCard } from './VehicleCard'
import { VehicleSection } from './VehicleSection'

/** Thẻ xe ở góc khung 3D của Planner và bảng thông số xe nó mở (thay nút "Đổi xe", FE-5b-08). */
const HD210: VehicleConfig = {
  ...SPEC_TRUCK_6M, id: 'VEHICLE-002', name: 'Hyundai HD210 · 60C-446.32', innerLengthCm: 720, innerWidthCm: 235, innerHeightCm: 240,
  maxPayloadKg: 8240, clearanceCm: 2,
  axles: [
    { id: 'A1', name: 'Trục trước', positionXCm: -100, emptyLoadKg: 2500, maxLoadKg: 6000 },
    { id: 'A2', name: 'Trục sau', positionXCm: 480, emptyLoadKg: 2000, maxLoadKg: 11000 },
  ],
}

function renderCard(vehicle: VehicleConfig, onChangeVehicle?: () => void) {
  render(<I18nProvider><VehicleCard vehicle={vehicle} onChangeVehicle={onChangeVehicle} /></I18nProvider>)
  return { user: userEvent.setup(), card: screen.getByRole('button', { name: `Xe của chuyến: ${vehicle.name}` }) }
}

test('the card names the vehicle with its cargo space and payload, and opens the vehicle details', async () => {
  const { user, card } = renderCard(HD210)
  expect(card).toHaveTextContent('Hyundai HD210 · 60C-446.32')
  expect(card).toHaveTextContent('720 × 235 × 240 cm · 8.240 kg')
  expect(card).toHaveAttribute('aria-expanded', 'false')

  await user.click(card)
  const panel = within(screen.getByRole('dialog', { name: 'Xe của chuyến' }))
  expect(card).toHaveAttribute('aria-expanded', 'true')
  const rows = panel.getAllByRole('term').map((term) => `${term.textContent}: ${term.nextElementSibling?.textContent}`)
  expect(rows).toStrictEqual([
    'Lòng thùng: 720 × 235 × 240 cm · 40,6 m³',
    'Cửa sau: 220 × 230 cm',
    'Khoảng hở: 2 cm',
    'Tải trọng tối đa: 8.240 kg',
    'Trục: 2 trục',
    'Giới hạn trục trước: 6.000 kg',
    'Giới hạn trục sau: 11.000 kg',
    'Vật cản: Hốc bánh xe × 1',
  ])
  // Người không đổi được xe: không có nút, không câu lý do
  expect(panel.queryByRole('button', { name: 'Đổi xe' })).toBeNull()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(card).toHaveFocus()
})

test('with a vehicle change allowed the footer button closes the details and opens the change dialog; focus goes back to the card', async () => {
  const onChange = vi.fn()
  const { user, card } = renderCard(HD210, onChange)
  await user.click(card)
  await user.click(within(screen.getByRole('dialog', { name: 'Xe của chuyến' })).getByRole('button', { name: 'Đổi xe' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
  expect(card).toHaveFocus()
})

test('a vehicle without axles says so; no obstacles reads "Không có"; no clearance row at 0 cm', async () => {
  const { user, card } = renderCard({ ...SPEC_TRUCK_6M, obstacles: [] })
  await user.click(card)
  const panel = within(screen.getByRole('dialog', { name: 'Xe của chuyến' }))
  expect(panel.getByText('Chưa khai trục')).toBeInTheDocument()
  expect(panel.getByText('Không có')).toBeInTheDocument()
  expect(panel.queryByText('Khoảng hở')).toBeNull()
  expect(panel.queryByText('Giới hạn trục trước')).toBeNull()
})

test('the inspector section for narrow screens shows the same figures', () => {
  render(<I18nProvider><VehicleSection vehicle={HD210} /></I18nProvider>)
  const section = within(screen.getByRole('region', { name: 'Xe của chuyến' }))
  expect(screen.getByRole('region', { name: 'Xe của chuyến' })).toHaveTextContent('Hyundai HD210 · 60C-446.32')
  expect(section.getByText('8.240 kg')).toBeInTheDocument()
})
