import type { Page } from '@playwright/test'
import { attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import { loadingOrderOf, stageInStore, typeVerifyCode } from './operations-helpers'
import { heightOf, MOCK_DB, navigateInApp, overflowingText, SEED_TRIP, switchUser } from './spec-flow-helpers'

/**
 * Màn kho đọc revision đã duyệt (LM-060); `/kho` là danh sách chuyến, `/kho?chuyen=` là phiên của chuyến ở kho (LM-086): bước Soạn hàng
 * rồi bước Xếp (FE-6-02, FE-6-05). Kho dữ liệu nằm trong bộ nhớ trang: sau khi ghi chỉ đổi route phía client.
 */

test.use({ collectConsoleErrors: true })

/** Cỡ chữ nhỏ nhất trong các vùng `regions`, px — bỏ chữ trong SVG. */
async function smallestText(regions: readonly ReturnType<Page['locator']>[]) {
  const sizes = await Promise.all(regions.map((region) => region.evaluate((root) => [root, ...root.querySelectorAll('*')]
    .filter((el) => [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) && !el.closest('svg'))
    .map((el) => Number.parseFloat(getComputedStyle(el).fontSize)))))
  return Math.min(...sizes.flat())
}

/** Rời phiên rồi mở lại: màn đọc lại tiến độ vừa ghi thẳng vào kho của trang. */
async function reopen(page: Page, tripId: string) {
  await navigateInApp(page, '/kho')
  await navigateInApp(page, `/kho?chuyen=${tripId}`)
}

for (const device of ['desktop', 'tablet'] as const) {
  const details = device === 'tablet' ? { tag: '@tablet' } : {}

  test(`${device}: approving in the Planner then opening the trip in /kho starts staging; once staged, loading starts at loadingOrder 1 of that revision`, details, async ({ page, login, browserErrors }) => {
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

    // Nhân viên kho đăng nhập ngay trong app (tải lại là mất bản vừa duyệt) rồi mở chuyến: bước Soạn hàng (FE-6-02)
    await switchUser(page, 'warehouse')
    await navigateInApp(page, `/kho?chuyen=${SEED_TRIP}`)
    await expect(page.getByRole('heading', { level: 1, name: `Kiện chưa soạn (${approved.total})`, exact: true })).toBeVisible()
    await expect(page.getByText(`Đã soạn 0 / ${approved.total}`)).toBeVisible()
    await expect(page.getByText('MOCK RESULT', { exact: true })).toBeVisible()
    const verify = page.getByRole('button', { name: 'Đối chiếu kiện', exact: true })
    const exit = page.getByRole('link', { name: 'Thoát phiên xếp hàng', exact: true })
    await expect(exit).toBeVisible()
    if (device === 'tablet') {
      expect(await heightOf(verify)).toBeGreaterThanOrEqual(56)
      expect(await heightOf(page.getByRole('button', { name: 'Báo thiếu', exact: true }).first())).toBeGreaterThanOrEqual(56)
      expect(await heightOf(exit)).toBeGreaterThanOrEqual(56)
      expect(await smallestText([page.getByRole('banner'), page.getByRole('main'), verify.locator('..')]), 'staging text is at least 16 px on tablet').toBeGreaterThanOrEqual(16)
      expect(await overflowingText(page)).toStrictEqual([])
    }

    // Soạn đủ (ghi thẳng vào kho của trang) thì sang bước Xếp ở kiện `loadingOrder = 1`
    await stageInStore(page, SEED_TRIP)
    await reopen(page, SEED_TRIP)
    const heading = page.getByRole('heading', { level: 1, name: approved.first, exact: true })
    await expect(heading).toBeVisible()
    await expect(page.getByText(`Bước 1 / ${approved.total}`)).toBeVisible()
    await expect(page.getByText('MOCK RESULT', { exact: true })).toBeVisible()
    await expect(page.getByText('Thứ tự xếp tính lại khi duyệt', { exact: true })).toBeVisible()
    await expect(page.getByText(/^Cách cửa sau$/)).toBeVisible()
    await expect(page.getByRole('img', { name: /^Minh hoạ hướng đặt (LWH|WLH|LHW|WHL|HLW|HWL)/ })).toBeVisible()
    // Thẻ hướng dẫn nói vùng của kiện trong thùng (FE-6-05)
    await expect(page.locator('[data-part="zone"]')).toHaveText(/^Vùng .+ — (sát cửa|giữa thùng|sát vách trước|cả thùng)$/)
    // Mỗi kiện phải đối chiếu: không có nút xác nhận không đối chiếu
    await expect(page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true })).toHaveCount(0)

    if (device === 'tablet') {
      expect(await heightOf(verify)).toBeGreaterThanOrEqual(56)
      expect(await heightOf(page.getByRole('button', { name: 'Kiện hỏng', exact: true }))).toBeGreaterThanOrEqual(56)
      expect(await heightOf(exit)).toBeGreaterThanOrEqual(56)
      // Chữ của màn kho: thanh trên, dải nhãn, thẻ hướng dẫn và hai nút. Toast của Planner và nhãn trong khung 3D không thuộc phần này.
      const card = heading.locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]')
      const text = await smallestText([page.getByRole('banner'), page.getByText('MOCK RESULT', { exact: true }).locator('..'), card, verify.locator('..')])
      expect(text, 'warehouse text is at least 16 px on tablet').toBeGreaterThanOrEqual(16)
    }

    await verify.click()
    await typeVerifyCode(page.getByRole('dialog', { name: 'Đối chiếu kiện bước 1' }), approved.first)
    await expect(page.getByRole('heading', { level: 1, name: approved.second, exact: true })).toBeVisible()
    await expect(page.getByText(`Bước 2 / ${approved.total}`)).toBeVisible()
    expect(browserErrors).toStrictEqual([])
  })
}

/**
 * FE-6-02, trên **một tab** (D-95): kho báo thiếu một kiện lúc soạn → điều phối viên nhận chuông, bỏ kiện khỏi chuyến → chuyến về Đã
 * lập kế hoạch, phương án lỗi thời, kho thấy "Chờ điều phối tối ưu lại" → điều phối viên tối ưu lại và duyệt → kho quay lại, kiện đã
 * soạn vẫn tính là đã soạn. Lần tối ưu lại ghi thẳng vào kho của trang bằng mock tối ưu — luồng tối ưu và duyệt trên giao diện có spec
 * riêng (`optimization-flow`, `plan-approval`).
 */
test('one tab: the warehouse reports a package missing, the dispatcher drops it, and after re-planning the warehouse resumes with the staged packages kept', async ({ page, login, browserErrors }) => {
  test.slow()
  await login('/kho', 'warehouse')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến cần xếp', exact: true })).toBeVisible()
  const tripCard = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: SEED_TRIP, exact: true }) })
  await tripCard.getByRole('link', { name: 'Bắt đầu soạn hàng', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Kiện chưa soạn (132)', exact: true })).toBeVisible()
  const order = await loadingOrderOf(page, SEED_TRIP)
  const [missing = '', stagedA = '', stagedB = ''] = order

  // Kho soạn hai kiện, không tìm thấy kiện thứ ba: báo thiếu
  await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
  const staging = page.getByRole('dialog', { name: 'Đối chiếu kiện vào khu chờ' })
  for (const id of [stagedA, stagedB]) {
    await typeVerifyCode(staging, id)
    await expect(staging.getByText(new RegExp(`^Đã soạn ${id} · `))).toBeVisible()
  }
  await staging.getByRole('button', { name: 'Đóng', exact: true }).click()
  await page.locator(`li[data-package-id="${missing}"]`).getByRole('button', { name: 'Báo thiếu', exact: true }).click()
  await page.getByRole('dialog', { name: `Báo thiếu ${missing}?` }).getByRole('button', { name: 'Báo thiếu', exact: true }).click()
  await expect(page.locator(`li[data-package-id="${missing}"]`)).toContainText('Đã báo thiếu — chờ điều phối')
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })

  // Điều phối viên: chuông báo kho thiếu kiện, mở chuyến; "Tìm tiếp" và "Bỏ kiện khỏi chuyến" ở thẻ Kiện kho báo thiếu
  await switchUser(page, 'dispatcher')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  const reported = page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Kho báo thiếu kiện khi soạn hàng' })
  await expect(reported).toHaveCount(1)
  await reported.click()
  await page.waitForURL(new RegExp(`/chuyen/${SEED_TRIP}$`))
  await expect(page.locator('header').getByText('Thiếu kiện — chờ điều phối', { exact: true })).toBeVisible()
  const shortages = page.getByRole('region', { name: 'Kiện kho báo thiếu' })
  await expect(shortages).toContainText(missing)
  await expect(shortages).toContainText('Lê Văn Hải báo lúc')
  await expect(shortages.getByRole('button', { name: `Tìm tiếp kiện ${missing}`, exact: true })).toBeVisible()
  await shortages.getByRole('button', { name: `Bỏ kiện ${missing} khỏi chuyến`, exact: true }).click()
  const drop = page.getByRole('dialog', { name: `Bỏ kiện ${missing} khỏi chuyến?` })
  await expect(drop).toContainText('Chuyến quay về Đã lập kế hoạch và phương án lỗi thời')
  await drop.getByRole('button', { name: 'Bỏ kiện', exact: true }).click()
  await expect(shortages).toHaveCount(0)
  // Chuyến về Đã lập kế hoạch, phương án lỗi thời
  await expect(page.locator('header').getByText('Đã lập kế hoạch', { exact: true })).toBeVisible()
  await expect(page.locator('header').getByText('Lỗi thời — cần tối ưu lại', { exact: true })).toBeVisible()
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })

  // Cùng kho: kiện bị bỏ về kho kiện kèm cờ "Không tìm thấy"; chuyến còn 131 kiện, hai kiện đã soạn giữ `STAGED`
  const dropped = await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    const trip = await store.getTrip(tripId)
    const pool = await store.listTripPackages(tripId)
    const flagged = (await store.listPackages()).filter((pkg) => pkg.source === 'TRIP' && pkg.flags.includes('NOT_FOUND'))
    return {
      phase: trip.phase, replan: trip.replan?.reason, packages: trip.packages.reduce((sum, line) => sum + line.quantity, 0),
      flagged: flagged.map((pkg) => [pkg.status, pkg.tripId ?? null]), staged: pool.filter((item) => item.package.status === 'STAGED').length,
    }
  }, { db: MOCK_DB, tripId: SEED_TRIP })
  expect(dropped).toStrictEqual({ phase: 'planning', replan: 'SHORTAGE', packages: 131, flagged: [['IMPORTED', null]], staged: 2 })

  // Kho: chuông báo kiện mình báo thiếu đã bị bỏ; chuyến nằm ở "Chờ điều phối tối ưu lại", không bắt đầu được
  await switchUser(page, 'warehouse')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  await expect(page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Bỏ kiện thiếu khỏi chuyến' })).toContainText(SEED_TRIP)
  await page.keyboard.press('Escape')
  const waiting = page.getByRole('list', { name: 'Chờ điều phối tối ưu lại', exact: true }).getByRole('listitem').filter({ has: page.getByRole('heading', { name: SEED_TRIP, exact: true }) })
  await expect(waiting).toContainText(`Điều phối viên đã bỏ kiện thiếu khỏi chuyến ${SEED_TRIP}. Kiện đã soạn giữ nguyên ở khu chờ`)
  await expect(waiting.getByRole('link')).toHaveCount(0)
  await navigateInApp(page, `/kho?chuyen=${SEED_TRIP}`)
  await expect(page.getByText('Chờ điều phối tối ưu lại', { exact: true })).toBeVisible()

  // Điều phối viên tối ưu lại và duyệt (mock tối ưu, ghi thẳng vào kho của trang)
  await switchUser(page, 'dispatcher')
  await page.evaluate(async ({ db, service, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const { runMockOptimization } = (await import(service)) as typeof import('@/services/optimization')
    const store = getMockDb()
    const trip = await store.getTrip(tripId)
    const request = {
      vehicle: await store.getVehicle(trip.vehicleId), packages: trip.packages,
      settings: { method: 'MOCK' as const, timeLimitSeconds: 30, randomSeed: 20_261_004, enforceLifo: true, prioritizeLowCenterOfGravity: false },
    }
    const revision = await store.addRevision({ tripId, request, result: runMockOptimization(request, { clock: () => 0 }) })
    await store.approveRevision(revision.id, [], { force: true })
  }, { db: MOCK_DB, service: '/src/services/optimization/index.ts', tripId: SEED_TRIP })

  // Kho quay lại: chuyến chờ soạn; mở ra thì hai kiện đã soạn vẫn tính — còn 129 trên 131 kiện phải soạn
  await switchUser(page, 'warehouse')
  const ready = page.getByRole('list', { name: 'Chờ soạn', exact: true }).getByRole('listitem').filter({ has: page.getByRole('heading', { name: SEED_TRIP, exact: true }) })
  await ready.getByRole('link', { name: 'Bắt đầu soạn hàng', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Kiện chưa soạn (129)', exact: true })).toBeVisible()
  await expect(page.getByText('Đã soạn 2 / 131')).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

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
  const start = card.getByRole('link', { name: 'Start staging', exact: true })
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

  // Bước Soạn hàng bằng tiếng Anh: chữ không tràn ở tablet dọc
  await expect(page.getByRole('heading', { level: 1, name: `Packages not staged (${plan.total})`, exact: true })).toBeVisible()
  await expect(page.getByText(`Staged 0 / ${plan.total}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Report missing', exact: true }).first()).toBeVisible()
  expect(await overflowingText(page)).toStrictEqual([])
  await attachScreenshot(page, testInfo, 'warehouse-staging-en-tablet-portrait')
  await stageInStore(page, SEED_TRIP)
  await reopen(page, SEED_TRIP)

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

  await page.getByRole('button', { name: 'Verify package', exact: true }).tap()
  await typeVerifyCode(page.getByRole('dialog', { name: 'Verify the package for step 1' }), plan.first, 'QR code or sender code')
  await expect(page.getByRole('heading', { level: 1, name: plan.second, exact: true })).toBeVisible()
  await expect(page.getByText(`Step 2 / ${plan.total}`)).toBeVisible()

  await vietnamese.tap()
  await expect(page.getByText(`Bước 2 / ${plan.total}`)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: plan.second, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đối chiếu kiện', exact: true })).toBeVisible()
  await english.tap()
  await expect(page.getByText(`Step 2 / ${plan.total}`)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: plan.second, exact: true })).toBeVisible()

  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(page.getByRole('button', { name: 'Damaged package', exact: true })).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Đối chiếu kiện', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Về danh sách chuyến', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kho' && url.search === '')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến cần xếp', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
