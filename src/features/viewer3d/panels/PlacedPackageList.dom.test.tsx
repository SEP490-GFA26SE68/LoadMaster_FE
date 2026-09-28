import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { ConstraintIssue } from '@/domain/constraints'
import { I18nProvider } from '@/lib/i18n'
import { seedScene } from '@/test/scene'
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
