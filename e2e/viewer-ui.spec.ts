import type { Page } from '@playwright/test'
import { attachJson, attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import { stageInStore, typeVerifyCode } from './operations-helpers'
import { MOCK_DB, navigateInApp } from './spec-flow-helpers'
import { cameraPreset, closeInspector, metrics, openInspector, SOURCE_MODULES, waitIdle, type ViewerMetrics } from './viewer-helpers'

const selectedPanel = (page: Page) => page.getByRole('complementary', { name: 'Kiện đang chọn' })

/** Lượt đầu vào route qua form đăng nhập (app quay lại đúng route), các lượt sau điều hướng thẳng. */
async function openViewer(page: Page, route: string, login?: (route: string) => Promise<void>) {
  await (login ? login(route) : page.goto(route))
  await page.locator('canvas').waitFor()
  await waitIdle(page)
}

test('planner idles under debug and keeps presets, edit toggles, colour modes, slice and playback working', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${PLANNER_ROUTE}?debug&quality=balanced`)
  await waitIdle(page)
  const normal = await metrics(page)
  expect(normal.placementCount).toBe('132')
  await page.waitForTimeout(1200)
  expect((await metrics(page)).renderedFrames, 'debug overlay must not keep rendering').toBe(normal.renderedFrames)
  const selected = selectedPanel(page)
  await openInspector(page, 'package')
  const seed = await page.evaluate(async (url) => {
    const { seedScene } = (await import(url)) as typeof import('@/test/scene')
    const model = await seedScene()
    return { firstId: model.placements[0]!.id, innerLengthCm: model.vehicle.innerLengthCm }
  }, SOURCE_MODULES.scene)
  expect(await selected.innerText()).toContain(seed.firstId)
  await attachScreenshot(page, testInfo, 'normal')
  await closeInspector(page)

  for (const name of ['Trên', 'Cửa sau', 'Bên hông', 'Trước', 'Góc chéo'] as const) {
    const before = Number((await metrics(page)).renderedFrames)
    await cameraPreset(page, name)
    await page.waitForTimeout(1100)
    expect(Number((await metrics(page)).renderedFrames), 'camera preset should wake demand rendering').toBeGreaterThan(before)
  }
  // Geometry-aware edit actions have their own gesture/validation suite.
  await openInspector(page, 'package')
  await selected.getByRole('button', { name: 'Chỉnh sửa kiện', exact: true }).click()
  await page.getByRole('button', { name: 'Ghim', exact: true }).click()
  await page.getByRole('button', { name: 'Bỏ ghim', exact: true }).click()
  await page.getByRole('button', { name: 'Xem', exact: true }).click()
  await openInspector(page, 'display')
  for (const name of ['Theo kiện gốc', 'Theo khối lượng', 'Theo điểm giao']) {
    await page.getByRole('button', { name, exact: true }).click()
  }
  const slice = page.getByRole('slider', { name: 'Cắt lớp theo chiều dài', exact: true })
  await slice.focus()
  await slice.press('Home')
  expect(await slice.inputValue()).toBe('0')
  await slice.press('End')
  expect(await slice.inputValue()).toBe(String(seed.innerLengthCm))
  await closeInspector(page)

  const timeline = page.getByRole('slider', { name: 'Bước xếp', exact: true })
  await page.getByRole('button', { name: 'Về đầu', exact: true }).click()
  expect(await timeline.inputValue()).toBe('1')
  await page.getByRole('button', { name: 'Tiến một bước', exact: true }).click()
  expect(await timeline.inputValue()).toBe('2')
  await page.getByRole('combobox', { name: 'Tốc độ phát', exact: true }).selectOption('4')
  await page.getByRole('button', { name: 'Phát', exact: true }).click()
  await page.waitForTimeout(1400)
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  expect(Number(await timeline.inputValue())).toBeGreaterThan(2)
  await waitIdle(page)
  await attachJson(testInfo, 'report', { normal, playback: await timeline.inputValue() })
  expect(browserErrors).toStrictEqual([])
})

test('benchmark fixtures stay under 100 draw calls and a snapshot change resets the draft', async ({ page, login, browserErrors }, testInfo) => {
  const report: Record<number, ViewerMetrics> = {}
  for (const count of [132, 300, 500, 1000]) {
    await openViewer(page, `${PLANNER_ROUTE}?debug&packages=${count}&quality=balanced`, count === 132 ? login : undefined)
    const sample = report[count] = await metrics(page)
    expect(sample.placementCount).toBe(String(count))
    expect(sample.qualityTier).toBe('balanced')
    expect(Number(sample.drawCalls)).toBeLessThan(100)
  }
  await attachScreenshot(page, testInfo, '1000')
  // Exercise router parameter changes without a page reload: reset source-bound draft.
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click()
  await page.getByRole('button', { name: 'Ghim', exact: true }).click()
  await page.evaluate(() => {
    history.pushState({}, '', '?debug&packages=300&quality=balanced')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.waitForFunction(() => document.querySelector('[data-viewer-performance]')?.getAttribute('data-placement-count') === '300')
  const selected = selectedPanel(page)
  await openInspector(page, 'package')
  await selected.getByRole('button', { name: 'Chỉnh sửa kiện', exact: true }).waitFor()
  expect(await selected.innerText()).toMatch(/Chưa ghim/)
  await attachJson(testInfo, 'report', { ...report, snapshotReset: true })
  expect(browserErrors).toStrictEqual([])
})

test('explicit quality tiers are honoured, including under reduced motion', async ({ page, login, browserErrors }, testInfo) => {
  const report: Record<string, ViewerMetrics> = {}
  for (const tier of ['low', 'high']) {
    await openViewer(page, `${PLANNER_ROUTE}?debug&packages=1000&quality=${tier}`, tier === 'low' ? login : undefined)
    const sample = report[tier] = await metrics(page)
    expect(sample.qualityTier).toBe(tier)
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Về đầu', exact: true }).click()
  await page.getByRole('button', { name: 'Tiến một bước', exact: true }).click()
  await waitIdle(page)
  report.reducedMotion = await metrics(page)
  await attachJson(testInfo, 'report', report)
  expect(browserErrors).toStrictEqual([])
})

test('benchmark fixture requires debug; warehouse camera, next step and driver 2D route still work', async ({ page, login, browserErrors }, testInfo) => {
  // Mỗi màn do vai trò của nó mở (FE-0-01); mỗi lượt là một lần tải trang — kho mới — nên đổi vai trò bằng cách bỏ phiên của tab
  await login(`${PLANNER_ROUTE}?packages=1000`)
  await page.locator('canvas').waitFor()
  expect(await page.locator('[data-viewer-performance]').count()).toBe(0)
  expect(await page.locator('header').innerText()).toMatch(/132/)

  // Tải trang là kho mới: kho bắt đầu chuyến seed và soạn đủ (FE-6-02, ghi thẳng vào kho của trang), vào phiên là bước Xếp 1 (LM-086)
  await page.evaluate(() => sessionStorage.clear())
  await login('/kho', 'warehouse')
  await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    await getMockDb().startLoading(tripId)
  }, { db: MOCK_DB, tripId: 'TRIP-2026-0914' })
  await stageInStore(page, 'TRIP-2026-0914')
  await navigateInApp(page, '/kho?chuyen=TRIP-2026-0914')
  await page.locator('canvas').waitFor()
  await page.getByRole('combobox', { name: 'Góc nhìn thùng xe', exact: true }).selectOption('cua-sau')
  await page.waitForTimeout(1000)
  await attachScreenshot(page, testInfo, 'warehouse')
  // Kho đọc revision đã duyệt của chuyến seed (LM-060): đối chiếu kiện bước 1 bằng mã của nó, sau đó là kiện `loadingOrder = 2`
  const [first, second] = await page.evaluate(async (url) => {
    const { seedScene } = (await import(url)) as typeof import('@/test/scene')
    const placements = (await seedScene()).placements
    return [1, 2].map((step) => placements.find((placement) => placement.step === step)!.id)
  }, SOURCE_MODULES.scene)
  await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
  await typeVerifyCode(page.getByRole('dialog', { name: 'Đối chiếu kiện bước 1' }), first ?? '')
  await expect(page.getByRole('heading', { level: 1, name: second, exact: true })).toBeVisible()

  // Chuyến đã xếp xong của tài xế demo (LM-087, tài xế chỉ thấy chuyến của mình): màn điểm giao 2D, chưa tải Three.js
  await page.evaluate(() => sessionStorage.clear())
  await login('/tai-xe/diem-giao?chuyen=TRIP-010', 'driver')
  await page.getByRole('button', { name: 'Xuất phát', exact: true }).waitFor()
  expect(await page.locator('canvas').count()).toBe(0)
  expect(browserErrors).toStrictEqual([])
})
