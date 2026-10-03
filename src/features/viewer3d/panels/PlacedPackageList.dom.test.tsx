import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { ConstraintIssue } from '@/domain/constraints'
import { I18nProvider } from '@/lib/i18n'
import { sceneBox, seedScene } from '@/test/scene'
import { PlacedPackageList } from './PlacedPackageList'

/** Seam: danh sách kiện đã xếp của Planner (LM-049) trên revision seed thật. */
async function renderList(issues: readonly ConstraintIssue[] = []) {
  const scene = await seedScene()
  const onSelect = vi.fn()
  render(
    <I18nProvider>
      <PlacedPackageList placements={scene.placements} stops={scene.stops} issues={issues} selectedId={null} onSelect={onSelect} />
    </I18nProvider>,
  )
  return { scene, onSelect }
}

const rows = () => within(screen.getByRole('list')).getAllByRole('button')

test('lists placed packages and narrows by stop and by id search', async () => {
  const { scene } = await renderList()
  expect(screen.getByText(`Đang hiện 100 / ${scene.placements.length} kiện`)).toBeInTheDocument()

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Mọi điểm giao' }), '2')
  const atStop2 = scene.placements.filter((p) => p.stop === 2)
  expect(rows()).toHaveLength(Math.min(atStop2.length, 100))

  const target = atStop2[0]!
  await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm theo mã kiện' }), target.id)
  // Dòng: ô điểm giao, mã kiện, rồi kích thước · khối lượng (V2.3)
  expect(rows().map((row) => row.textContent?.slice(0, target.id.length + 1))).toContain(`2${target.id}`)
})

test('a package outside the zone of its stop is marked in its row and can be filtered for; a plan with none has no such filter', async () => {
  const { scene } = await renderList()
  // the approved seed plan keeps every package in the zone of its own stop
  expect(screen.queryByRole('checkbox', { name: 'Chỉ kiện nằm ngoài vùng' })).not.toBeInTheDocument()
  expect(screen.queryByText('Ngoài vùng')).not.toBeInTheDocument()
  cleanup()

  const placements = [sceneBox('A-01', 0, 0, 0, { step: 1, stop: 2, zoneId: 'ZONE-2' }), sceneBox('B-01', 100, 0, 0, { step: 2, stop: 1, zoneId: 'ZONE-2', outOfZone: true })]
  render(<I18nProvider><PlacedPackageList placements={placements} stops={scene.stops} issues={[]} selectedId={null} onSelect={() => undefined} /></I18nProvider>)
  expect(rows().map((row) => [row.textContent?.includes('A-01'), row.textContent?.includes('Ngoài vùng')])).toStrictEqual([[true, false], [false, true]])
  await userEvent.click(screen.getByRole('checkbox', { name: 'Chỉ kiện nằm ngoài vùng' }))
  expect(rows().map((row) => row.textContent?.includes('B-01'))).toStrictEqual([true])
})

test('only-warnings keeps the packages an issue names, and a click selects', async () => {
  const scene = await seedScene()
  const [first, second] = scene.placements
  const { onSelect } = await renderList([
    { code: 'NOT_STACKABLE', severity: 'warning', packageInstanceId: first!.id, relatedIds: [second!.id], params: {} },
  ] satisfies ConstraintIssue[])
  await userEvent.click(screen.getByRole('checkbox', { name: 'Chỉ kiện có cảnh báo' }))
  expect(rows()).toHaveLength(2)
  await userEvent.click(rows()[0]!)
  expect(onSelect).toHaveBeenCalledWith(first!.id)
})
