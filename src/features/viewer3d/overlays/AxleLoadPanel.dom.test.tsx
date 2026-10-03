import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import { I18nProvider } from '@/lib/i18n'
import { sceneBox, seedScene } from '@/test/scene'
import type { ScenePlacement } from '../scene-input'
import { AxleLoadPanel } from './AxleLoadPanel'

/** Seam: ô "Tải trục" của hộp thông tin Planner (FE-5b-03) — số và giới hạn, hoặc lý do chưa tính. */
function renderPanel(vehicle: VehicleConfig, placements: readonly ScenePlacement[]) {
  render(
    <I18nProvider>
      <AxleLoadPanel vehicle={vehicle} placements={placements} />
    </I18nProvider>,
  )
  return within(screen.getByRole('region', { name: 'Tải trục' }))
}

test('the seed plan runs on a vehicle without axles: no figure, only the reason it is not computed', async () => {
  const scene = await seedScene()
  const panel = renderPanel(scene.vehicle, scene.placements)
  expect(panel.getByText('Chưa tính được: xe này chưa khai báo trục. Khai vị trí, tải rỗng và tải tối đa của trục ở trang xe.')).toBeInTheDocument()
  expect(panel.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(panel.queryByText(/kg/)).not.toBeInTheDocument()
})

test('a vehicle with axles shows the front and rear loads against their limits, marked MOCK RESULT, and says by how much one is over', async () => {
  const { vehicle } = await seedScene()
  // Trục trước ở x −120 (rỗng 2.000 kg), hai trục sau ở 400 và 520 → nhóm sau tại 460 (rỗng 1.800 kg), cách nhau 580 cm.
  const axles = [
    { id: 'AXLE-01', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 2000, maxLoadKg: 3000 },
    { id: 'AXLE-02', name: 'Trục sau 1', positionXCm: 400, emptyLoadKg: 900, maxLoadKg: 4500 },
    { id: 'AXLE-03', name: 'Trục sau 2', positionXCm: 520, emptyLoadKg: 900, maxLoadKg: 4500 },
  ]
  // 580 kg tâm x 25 và 870 kg tâm x 315 → trọng tâm 199: trục sau nhận 1450 × 319 / 580 = 797,5 kg, trục trước 652,5 kg.
  const placements = [
    sceneBox('A-01', 0, 0, 0, { lengthCm: 50, weightKg: 580 }),
    sceneBox('B-01', 290, 0, 0, { lengthCm: 50, weightKg: 870 }),
  ]
  const panel = renderPanel({ ...vehicle, axles, frontAxleLimitKg: 2600 }, placements)
  expect(panel.getByText('MOCK RESULT')).toBeInTheDocument()
  const row = (label: string) => within(panel.getByText(label).closest('div')!)
  // Giới hạn trục trước của loại xe (2.600 kg) thắng tải tối đa của trục (3.000 kg); trục sau lấy tổng hai trục: 9.000 kg
  expect(row('Trục trước').getByText('2.652,5 kg / 2.600 kg')).toBeInTheDocument()
  expect(row('Trục trước').getByText('Vượt 52,5 kg')).toBeInTheDocument()
  expect(row('Trục sau').getByText('2.597,5 kg / 9.000 kg')).toBeInTheDocument()
  expect(row('Trục sau').queryByText(/Vượt/)).not.toBeInTheDocument()
})

test('a single declared axle is not enough to compute', async () => {
  const { vehicle } = await seedScene()
  const panel = renderPanel({ ...vehicle, axles: [{ id: 'AXLE-01', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 2000, maxLoadKg: 3000 }] }, [])
  expect(panel.getByText('Chưa tính được: xe mới khai một trục, cần ít nhất một trục trước và một trục sau.')).toBeInTheDocument()
})
