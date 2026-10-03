import { expect, test } from './fixtures'
import { heightOf, MOCK_DB, SEED_TRIP } from './spec-flow-helpers'

/**
 * LM-086: nhân viên kho chọn chuyến ở `/kho`, ghi tiến độ và kiện thiếu vào kho, rời phiên rồi vào lại thì tiếp tục đúng bước.
 * Kho dữ liệu nằm trong bộ nhớ trang: chỉ bấm trong app, không tải lại trang giữa chừng.
 */
test.use({ collectConsoleErrors: true })

test('tablet: pick the main trip, record two loaded and one missing, leave and resume at the right step', { tag: '@tablet' }, async ({ page, login, browserErrors }) => {
  await login('/kho', 'warehouse')
  // Thẻ của chuyến đổi nhóm theo trạng thái (FE-6-01): "Chờ soạn" lúc đầu, "Đang xếp hàng" khi kho đã bắt đầu
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: SEED_TRIP, exact: true }) })
  await expect(page.getByRole('list', { name: 'Chờ soạn', exact: true }).getByRole('heading', { name: SEED_TRIP, exact: true })).toBeVisible()
  const start = card.getByRole('link', { name: 'Bắt đầu xếp', exact: true })
  expect(await heightOf(start)).toBeGreaterThanOrEqual(56)

  const plan = await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const revision = (await getMockDb().listRevisions(tripId)).findLast((item) => item.approvedAt !== undefined)!
    return revision.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).slice(0, 4).map((p) => p.packageInstanceId)
  }, { db: MOCK_DB, tripId: SEED_TRIP })
  const [first = '', second = '', third = '', fourth = ''] = plan
  const heading = (id: string) => page.getByRole('heading', { level: 1, name: id, exact: true })
  const confirm = page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true })

  await start.tap()
  await expect(heading(first)).toBeVisible()
  await expect(page.getByText('Bước 1 / 132', { exact: true })).toBeVisible()
  await confirm.tap()
  await expect(heading(second)).toBeVisible()
  await confirm.tap()
  await expect(heading(third)).toBeVisible()

  await page.getByRole('button', { name: 'Kiện này không có ở kho', exact: true }).tap()
  const record = page.getByRole('dialog', { name: `Ghi thiếu ${third}?` }).getByRole('button', { name: 'Ghi thiếu', exact: true })
  expect(await heightOf(record)).toBeGreaterThanOrEqual(56)
  await record.tap()
  await expect(heading(fourth)).toBeVisible()
  await expect(page.getByText('Bước 4 / 132', { exact: true })).toBeVisible()

  // Rời phiên bằng nút thoát — nhân viên kho về danh sách chuyến, không đăng xuất — rồi vào lại
  await page.getByRole('link', { name: 'Thoát phiên xếp hàng', exact: true }).tap()
  await page.waitForURL((url) => url.pathname === '/kho' && url.search === '')
  await expect(page.getByRole('list', { name: 'Đang xếp hàng', exact: true }).getByRole('heading', { name: SEED_TRIP, exact: true })).toBeVisible()
  await expect(card.getByText('Đang xếp hàng', { exact: true })).toBeVisible()
  await expect(card.getByText('Đang xếp 3 / 132', { exact: true })).toBeVisible()
  await expect(card.getByText('· thiếu 1', { exact: true })).toBeVisible()
  await card.getByRole('link', { name: 'Tiếp tục (3/132)', exact: true }).tap()
  await expect(heading(fourth)).toBeVisible()
  await expect(page.getByText('Bước 4 / 132', { exact: true })).toBeVisible()

  // Điều phối viên đọc cùng kho: chuyến Đang xếp hàng, dòng phụ là tiến độ kho (FE-0-05), kiện thiếu đúng kiện vừa báo
  const store = await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb, missingIds, tripStatus, tripSubStatus } = (await import(db)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(tripId)
    const revisions = await getMockDb().listRevisions(tripId)
    return { status: tripStatus(trip), sub: tripSubStatus(trip, revisions), missing: [...missingIds(trip)] }
  }, { db: MOCK_DB, tripId: SEED_TRIP })
  expect(store).toStrictEqual({ status: 'LOADING', sub: { kind: 'loading', recorded: 3, total: 132 }, missing: [third] })
  expect(browserErrors).toStrictEqual([])
})
