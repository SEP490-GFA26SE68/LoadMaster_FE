import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { seedScene } from '@/test/scene'
import type { SceneUnplaced } from '../scene-input'
import { PackageListPanel } from './PackageListPanel'

/** Seam: khối "Kiện chưa xếp" của hộp thông tin Planner — lý do `CONSTRAINT_VIOLATED` kèm câu của ràng buộc đã chặn (FE-5b-04). */
test('a package left out for a constraint shows the reason and the sentence of each constraint that stopped it', async () => {
  const scene = await seedScene()
  const unplaced: SceneUnplaced[] = [
    {
      id: 'PKG-009-01', packageId: 'PKG-009', name: 'Bao xi măng 50 kg', stop: 2, lengthCm: 80, widthCm: 50, heightCm: 15, weightKg: 50,
      reasonCode: 'CONSTRAINT_VIOLATED', message: 'CONSTRAINT_VIOLATED',
      violatedConstraints: [{ code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'rear', loadKg: 6240.5, limitKg: 6000, overKg: 240.5 } }],
    },
    { id: 'PKG-010-01', packageId: 'PKG-010', name: 'Thùng sơn 18 lít', stop: 1, lengthCm: 30, widthCm: 30, heightCm: 40, weightKg: 22, reasonCode: 'NO_SPACE', message: 'NO_SPACE' },
  ]
  render(
    <MemoryRouter>
      <I18nProvider>
        <PackageListPanel unplaced={unplaced} pinned={[]} placements={scene.placements} vehicle={scene.vehicle} selectedId={null} onSelect={() => undefined}
          stops={scene.stops} issues={[]} tripId={scene.tripId} />
      </I18nProvider>
    </MemoryRouter>,
  )
  const section = within(screen.getByRole('region', { name: 'Kiện chưa xếp' }))
  const blocked = within(section.getByRole('link', { name: 'PKG-009-01' }).closest('li')!)
  expect(blocked.getByText('Xếp kiện này sẽ vi phạm ràng buộc')).toBeInTheDocument()
  expect(blocked.getByText('Tải trục sau 6.240,5 kg vượt giới hạn 6.000 kg (quá 240,5 kg).')).toBeInTheDocument()
  const noSpace = within(section.getByRole('link', { name: 'PKG-010-01' }).closest('li')!)
  expect(noSpace.getByText('Không còn chỗ trống vừa kiện')).toBeInTheDocument()
  expect(noSpace.queryByRole('list')).not.toBeInTheDocument()
})
