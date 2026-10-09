import type { Page } from '@playwright/test'
import { expect, PLANNER_ROUTE, test } from './fixtures'

/**
 * Ghim rồi chạy lại giữ ghim (FE-BL-02): điều phối viên ghim một kiện trong Planner, "Duyệt bản chỉnh" để lưu ghim cùng phương án, bấm
 * "Chạy lại giữ ghim" ở góc khung 3D, chạy ở Thiết lập tối ưu — ba phương án mới đều có kiện đó đúng chỗ cũ, đánh dấu đã ghim.
 * Dữ liệu đọc qua đúng module kho app đang dùng.
 */
test.use({ collectConsoleErrors: true })

const TRIP_ID = 'TRIP-2026-0914'
const MOCK_DB = '/src/lib/mock-db/index.ts'
const PINNED = 'PKG-001-01'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/** Chỗ của `PINNED` trong ba revision mới nhất của chuyến, và số kiện ghim lần chạy cuối ghi nhận. */
function placementsOf(page: Page, revisionIds: readonly string[]) {
  return page.evaluate(async ({ url, tripId, ids, packageId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const revisions = (await db.listRevisions(tripId)).filter((revision) => ids.length === 0 || ids.includes(revision.id))
    return revisions.map((revision) => {
      const placement = revision.result.placements.find((item) => item.packageInstanceId === packageId)
      return { id: revision.id, at: placement ? [placement.xCm, placement.yCm, placement.zCm, placement.orientation] : null, pinned: placement?.pinned ?? false }
    })
  }, { url: MOCK_DB, tripId: TRIP_ID, ids: revisionIds, packageId: PINNED })
}

test('a pinned package is saved with the approved plan and keeps its place in all three plans of the next run', async ({ page, login, browserErrors }) => {
  test.setTimeout(3 * 60_000)
  await login(PLANNER_ROUTE, 'dispatcher')
  await page.locator('canvas').waitFor()
  // Chưa ghim kiện nào: không có nhãn kiện đã ghim và không có nút chạy lại giữ ghim
  await expect(button(page, 'Chạy lại giữ ghim')).toHaveCount(0)
  const [original] = await placementsOf(page, [])
  expect(original?.pinned).toBe(false)

  // Ghim ở chế độ Chỉnh sửa: ghim là chỉnh sửa cần Duyệt để lưu, dù không dời kiện nào
  await button(page, 'Chỉnh sửa').click()
  const picker = page.getByRole('combobox', { name: 'Chọn kiện', exact: true })
  await picker.selectOption(PINNED)
  await button(page, 'Ghim').click()
  await button(page, 'Duyệt bản chỉnh').click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click()
  await expect(page).toHaveURL(/\/phuong-an\?revision=REV-\d+/)
  const approvedId = new URL(page.url()).searchParams.get('revision') ?? ''

  // Ghim sống qua Duyệt: bản duyệt mới nhớ kiện ghim, đúng chỗ cũ, và Planner mở lại thấy nhãn cùng nút chạy lại
  const [approved] = await placementsOf(page, [approvedId])
  expect(approved).toMatchObject({ id: approvedId, pinned: true })
  await expect(page.getByText('1 kiện đã ghim', { exact: true })).toBeVisible()
  await button(page, 'Chạy lại giữ ghim').click()

  // Thiết lập tối ưu: lựa chọn giữ ghim bật sẵn, nói rõ nó làm gì; vẫn một nút chính "Tối ưu"
  await expect(page).toHaveURL(new RegExp(`/toi-uu\\?giu-ghim=${approvedId}$`))
  await expect(page.getByRole('heading', { name: 'Giữ kiện đã ghim', exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Giữ nguyên chỗ 1 kiện đã ghim' })).toBeChecked()
  await button(page, 'Tối ưu').click()
  await page.waitForURL(/\/so-sanh\?lan-chay=RUN-\d+/)
  await expect(page.locator('[data-candidate]')).toHaveCount(3)
  await expect(page.locator('[data-run-pinned]')).toHaveText('Lần chạy này giữ nguyên chỗ 1 kiện đã ghim.')

  // Ba revision mới của lần chạy: kiện ghim đúng chỗ và hướng đã duyệt, vẫn đánh dấu đã ghim
  const all = await placementsOf(page, [])
  const fresh = all.slice(-3)
  expect(fresh.map(({ id }) => id)).not.toContain(approvedId)
  for (const revision of fresh) expect(revision, revision.id).toMatchObject({ at: approved?.at, pinned: true })
  expect(browserErrors).toStrictEqual([])
})
