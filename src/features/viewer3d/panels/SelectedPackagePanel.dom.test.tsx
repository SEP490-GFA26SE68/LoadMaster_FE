import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { sceneBox } from '@/test/scene'
import type { ScenePlacement, SceneStop, SceneZone } from '../scene-input'
import { SelectedPackagePanel } from './SelectedPackagePanel'

/** Seam: ô "Vùng điểm giao" của thẻ kiện đang chọn (FE-5b-07). */
const STOPS: SceneStop[] = [
  { number: 1, name: 'Co.opmart Bình Dương', packageCount: 1 },
  { number: 2, name: 'Bách Hoá Xanh Dĩ An', packageCount: 1 },
]
const ZONES: SceneZone[] = [
  { id: 'ZONE-1', stopId: 1, startXCm: 305, endXCm: 600, name: 'Co.opmart Bình Dương', sharePercent: 50 },
  { id: 'ZONE-2', stopId: 2, startXCm: 0, endXCm: 295, name: 'Bách Hoá Xanh Dĩ An', sharePercent: 50 },
]

function renderCard(placement: ScenePlacement, zones: readonly SceneZone[] = ZONES) {
  render(
    <MemoryRouter>
      <I18nProvider>
        <SelectedPackagePanel placement={placement} placements={[placement]} totalSteps={1} stops={STOPS} zones={zones} tripId="TRIP-001" onFocus={() => undefined} />
      </I18nProvider>
    </MemoryRouter>,
  )
  return within(screen.getByRole('complementary', { name: 'Kiện đang chọn' }))
}

test('a package in the zone of its own stop shows that zone and the name of the stop', () => {
  const card = renderCard(sceneBox('A-01', 0, 0, 0, { stop: 2, zoneId: 'ZONE-2' }))
  const cell = within(card.getByText('Vùng điểm giao').closest('div')!)
  expect(cell.getByText('Vùng điểm 2')).toBeInTheDocument()
  expect(cell.getByText('Bách Hoá Xanh Dĩ An')).toBeInTheDocument()
  expect(cell.queryByText('Ngoài vùng')).not.toBeInTheDocument()
})

test('a package sitting in the zone of another stop shows where it sits, the "out of zone" mark and what it costs', () => {
  const card = renderCard(sceneBox('B-01', 100, 0, 0, { stop: 1, zoneId: 'ZONE-2', outOfZone: true }))
  const cell = within(card.getByText('Vùng điểm giao').closest('div')!)
  expect(cell.getByText('Vùng điểm 2')).toBeInTheDocument()
  expect(cell.getByText('Ngoài vùng')).toBeInTheDocument()
  expect(cell.getByText('Nằm ngoài vùng của điểm 1 — tính một lần dỡ-xếp lại.')).toBeInTheDocument()
})

test('a plan without stop zones has no zone cell', () => {
  const card = renderCard(sceneBox('A-01'), [])
  expect(card.queryByText('Vùng điểm giao')).not.toBeInTheDocument()
})
