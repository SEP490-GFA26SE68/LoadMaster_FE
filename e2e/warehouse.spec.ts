import { attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import { heightOf, MOCK_DB, navigateInApp, overflowingText, SEED_TRIP, switchUser } from './spec-flow-helpers'

/**
 * Màn kho đọc revision đã duyệt (LM-060); `/kho` là danh sách chuyến, `/kho?chuyen=` là phiên xếp (LM-086). Kho dữ liệu nằm trong
 * bộ nhớ trang: sau khi ghi chỉ đổi route phía client.
 */

test.use({ collectConsoleErrors: true })

for (const device of ['desktop', 'tablet'] as const) {
  const details = device === 'tablet' ? { tag: '@tablet' } : {}

  test(`${device}: approving in the Planner then opening the trip in /kho starts at loadingOrder 1 of that revision`, details, async ({ page, login, browserErrors }) => {
    // Bản seed đã duyệt không có nút Duyệt (LM-094): điều phối viên duyệt lại revision nguồn chưa duyệt REV-001
    await login(`${PLANNER_ROUTE}?revision=REV-001`, 'dispatcher')
    await page.locator('canvas').waitFor()
    await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
    await page.getByRole('dialog', { name: 'Duyệt phương án này?' }).getByRole('button', { name: 'Duyệt', exact: true }).click()
    await page.waitForURL(/\/phuong-an\?revision=REV-(?!001)/)
    const approvedId = new URL(page.url()).searchParams.get('revision')

    const approved = await page.evaluate(async ({ db, tripId }) => {
      const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
      const revision = (await getMockDb().listRevisions(tripId)).findLast((item) => item.approvedAt !== undefined)!
      const byOrder = (order: number) => revision.result.placements.find((placement) => placement.loadingOrder === order)!.packageInstanceId
      return { id: revision.id, first: byOrder(1), second: byOrder(2), total: revision.result.placements.length }
    }, { db: MOCK_DB, tripId: SEED_TRIP })
    expect(approved.id).toBe(approvedId)

    // Nhân viên kho đăng nhập ngay trong app (tải lại là mất bản vừa duyệt) rồi mở phiên xếp của chuyến
    await switchUser(page, 'warehouse')
    await navigateInApp(page, `/kho?chuyen=${SEED_TRIP}`)
    const heading = page.getByRole('heading', { level: 1, name: approved.first, exact: true })
    await expect(heading).toBeVisible()
    await expect(page.getByText(`Bước 1 / ${approved.total}`)).toBeVisible()
    await expect(page.getByText('MOCK RESULT', { exact: true })).toBeVisible()
    await expect(page.getByText('Thứ tự xếp tính lại khi duyệt', { exact: true })).toBeVisible()
    await expect(page.getByText(/^Cách cửa sau$/)).toBeVisible()
    await expect(page.getByRole('img', { name: /^Minh hoạ hướng đặt (LWH|WLH|LHW|WHL|HLW|HWL)/ })).toBeVisible()

    const confirm = page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true })
    const exit = page.getByRole('link', { name: 'Thoát phiên xếp hàng', exact: true })
    await expect(exit).toBeVisible()
    if (device === 'tablet') {
      expect(await heightOf(confirm)).toBeGreaterThanOrEqual(56)
      expect(await heightOf(page.getByRole('button', { name: 'Kiện này không có ở kho', exact: true }))).toBeGreaterThanOrEqual(56)
      expect(await heightOf(exit)).toBeGreaterThanOrEqual(56)
      // Chữ của màn kho: thanh trên, dải nhãn, thẻ hướng dẫn và hai nút. Toast của Planner và nhãn trong khung 3D không thuộc phần này.
      const card = heading.locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]')
      const sizes = await Promise.all([page.getByRole('banner'), page.getByText('MOCK RESULT', { exact: true }).locator('..'), card, confirm.locator('..')]
        .map((region) => region.evaluate((root) => [root, ...root.querySelectorAll('*')]
          .filter((el) => [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) && !el.closest('svg'))
          .map((el) => Number.parseFloat(getComputedStyle(el).fontSize)))))
      expect(Math.min(...sizes.flat()), 'warehouse text is at least 16 px on tablet').toBeGreaterThanOrEqual(16)
    }

    await confirm.click()
    await expect(page.getByRole('heading', { level: 1, name: approved.second, exact: true })).toBeVisible()
    await expect(page.getByText(`Bước 2 / ${approved.total}`)).toBeVisible()
    expect(browserErrors).toStrictEqual([])
  })
}

/**
 * LM-071, LM-086: danh sách chuyến và phiên kho chạy bằng `?lang=en`, nút chuyển ngôn ngữ trên header đạt 56px, đổi ngôn ngữ giữa
 * phiên giữ bước đang xếp, chữ tiếng Anh không tràn ở tablet dọc (project) và ngang 1024×768. Tải trang để đặt `?lang` trước mọi
 * lần ghi kho; sau đó chỉ bấm trong app.
 */
test('tablet: the warehouse runs in English and switching language mid-session keeps the step', { tag: '@tablet' }, async ({ page, login, browserErrors }, testInfo) => {
  await login('/kho', 'warehouse')
  await page.goto('/kho?lang=en')
  await expect(page.getByRole('heading', { level: 1, name: 'Trips to load', exact: true })).toBeVisible()
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: SEED_TRIP, exact: true }) })
  const start = card.getByRole('link', { name: 'Start loading', exact: true })
  expect(await heightOf(start)).toBeGreaterThanOrEqual(56)
  expect(await overflowingText(page)).toStrictEqual([])
  await attachScreenshot(page, testInfo, 'warehouse-list-en-tablet-portrait')

  const plan = await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const revision = (await getMockDb().listRevisions(tripId)).findLast((item) => item.approvedAt !== undefined)!
    const byOrder = (order: number) => revision.result.placements.find((placement) => placement.loadingOrder === order)!.packageInstanceId
    return { first: byOrder(1), second: byOrder(2), total: revision.result.placements.length }
  }, { db: MOCK_DB, tripId: SEED_TRIP })
  await start.tap()

  await expect(page.getByRole('heading', { level: 1, name: plan.first, exact: true })).toBeVisible()
  await expect(page.getByText(`Step 1 / ${plan.total}`)).toBeVisible()
  await expect(page.getByText('Package to load', { exact: true })).toBeVisible()
  await expect(page.getByText('MOCK RESULT', { exact: true })).toBeVisible()
  const english = page.getByRole('button', { name: 'EN English', exact: true })
  const vietnamese = page.getByRole('button', { name: 'VI Tiếng Việt', exact: true })
  await expect(english).toHaveAttribute('aria-pressed', 'true')
  expect(await heightOf(english)).toBeGreaterThanOrEqual(56)
  expect(await heightOf(vietnamese)).toBeGreaterThanOrEqual(56)
  expect(await overflowingText(page)).toStrictEqual([])
  await attachScreenshot(page, testInfo, 'warehouse-en-tablet-portrait')

  await page.getByRole('button', { name: 'Confirm loaded', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: plan.second, exact: true })).toBeVisible()
  await expect(page.getByText(`Step 2 / ${plan.total}`)).toBeVisible()

  await vietnamese.tap()
  await expect(page.getByText(`Bước 2 / ${plan.total}`)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: plan.second, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true })).toBeVisible()
  await english.tap()
  await expect(page.getByText(`Step 2 / ${plan.total}`)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: plan.second, exact: true })).toBeVisible()

  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(page.getByRole('button', { name: 'Package not in the warehouse', exact: true })).toBeVisible()
  expect(await overflowingText(page)).toStrictEqual([])
  await attachScreenshot(page, testInfo, 'warehouse-en-tablet-landscape')
  expect(browserErrors).toStrictEqual([])
})

test('a trip without an approved plan shows the empty state with a way out', async ({ page, login, browserErrors }) => {
  await login('/kho', 'warehouse')
  const tripId = await page.evaluate(async (db) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    const seed = await store.getTrip('TRIP-2026-0914')
    const trip = await store.createTrip({ name: 'Tuyến chưa duyệt', vehicleId: seed.vehicleId, stops: seed.stops, packages: seed.packages, scheduledDate: seed.scheduledDate })
    return trip.id
  }, MOCK_DB)

  await navigateInApp(page, `/kho?chuyen=${tripId}`)
  await expect(page.getByText('Chưa có phương án đã duyệt', { exact: true })).toBeVisible()
  await expect(page.getByText(`Chuyến ${tripId} chưa có phương án đã duyệt.`, { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Về danh sách chuyến', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kho' && url.search === '')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến cần xếp', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
