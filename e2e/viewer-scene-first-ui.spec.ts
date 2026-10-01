import type { Page, TestInfo } from '@playwright/test'
import { attachJson, attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import {
  cameraPreset, closeInspector, enterEdit, focusStop, hasSceneObject, instancePoint, metrics, openInspector, proxyPoint, sceneSnapshot,
  selectPlacement, settle as settleFor, SOURCE_MODULES, waitCameraSettled, type ViewerMetrics,
} from './viewer-helpers'

type SceneShot = { name: string; canvas: Awaited<ReturnType<ReturnType<Page['locator']>['boundingBox']>>; metrics: ViewerMetrics }

test.use({ collectConsoleErrors: true })

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const settle = (page: Page) => settleFor(page, 700)

/** Ảnh cảnh (ẩn overlay debug) kèm khung canvas và số đo, như `shot()` của bản `.mjs`. */
function shooter(page: Page, testInfo: TestInfo) {
  const scenes: SceneShot[] = []
  const shot = async (name: string, idle = true) => {
    if (idle) await settle(page)
    await attachScreenshot(page, testInfo, name, { style: '[data-viewer-performance] { visibility: hidden !important; }' })
    scenes.push({ name, canvas: await page.locator('canvas').boundingBox(), metrics: await metrics(page) })
  }
  return { shot, scenes }
}

test('planner defaults to the scene; follow step, stop focus, unloading advisory and centre of mass', async ({ page, login, browserErrors }, testInfo) => {
  const { shot, scenes } = shooter(page, testInfo)
  await login(`${PLANNER_ROUTE}?debug&quality=balanced`); await settle(page)
  expect(await page.getByRole('dialog').count()).toBe(0)
  expect((await page.locator('canvas').boundingBox())!.width).toBeGreaterThanOrEqual(1580)
  expect(await hasSceneObject(page, 'stop-distribution')).toBe(false)
  await shot('01-planner-default')
  const seedOrders = await page.evaluate(async ({ scene, operations }) => {
    const plan = await ((await import(scene)) as typeof import('@/test/scene')).seedScene()
    const { unloadSequence } = (await import(operations)) as typeof import('@/features/viewer3d/operations/unloading')
    const { ordered, fromResult } = unloadSequence(plan.placements)
    return { fromResult, unloading: ordered.map((p) => p.id), loading: plan.placements.toSorted((a, b) => a.step - b.step).map((p) => p.id) }
  }, SOURCE_MODULES)
  expect(seedOrders.fromResult).toBe(true)
  await page.getByRole('slider', { name: 'Bước xếp', exact: true }).fill('47'); await shot('02-loading-middle')
  // Phát xếp theo `loadingOrder` của revision seed
  expect(await page.locator('[data-operation-timeline]').innerText()).toContain(`· ${seedOrders.loading[46]}`)
  await button(page, 'Theo bước: Tắt').click(); await settle(page)
  const before = await sceneSnapshot(page)
  await button(page, 'Tiến một bước').click(); await settle(page)
  const after = await sceneSnapshot(page)
  expect(after.target).not.toStrictEqual(before.target)
  const r = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(r.x + r.width * 0.65, r.y + r.height * 0.5); await page.mouse.down()
  await page.mouse.move(r.x + r.width * 0.65 + 50, r.y + r.height * 0.5 + 20, { steps: 8 }); await page.mouse.up()
  await button(page, 'Tiếp tục theo bước').waitFor(); await page.keyboard.press('Escape')
  await settle(page)
  await button(page, 'Xem toàn xe').click(); await settle(page)
  await focusStop(page, 2); await shot('03-stop-two')
  expect(await page.evaluate(async (url) => {
    const { seedScene } = (await import(url)) as typeof import('@/test/scene')
    return (await seedScene()).placements.find((p) => p.step === Number(document.querySelector<HTMLInputElement>('input[aria-label="Bước xếp"]')!.value))?.stop
  }, SOURCE_MODULES.scene), 'stop focus must not leave the current label on a different stop').toBe(2)
  await button(page, 'Dỡ hàng').click(); await shot('04-unloading-clear')
  // LM-036: phát dỡ đi đúng `unloadingOrder` của revision seed; seed đã duyệt không có ca LIFO nên mô phỏng không dừng
  const timeline = page.locator('[data-operation-timeline]')
  const unloadSlider = page.getByRole('slider', { name: 'Đã dỡ', exact: true })
  expect(await timeline.innerText()).toContain(`· ${seedOrders.unloading[0]}`)
  for (let i = 1; i <= 3; i++) {
    await button(page, 'Tiến một bước').click()
    await expect.poll(() => unloadSlider.inputValue()).toBe(String(i))
    expect(await timeline.innerText()).toContain(`· ${seedOrders.unloading[i]}`)
  }
  await shot('05-unloading-order')
  await openInspector(page, 'operations')
  expect(await page.getByRole('dialog').innerText(), 'approved seed orders were recomputed on approval (D-32)').toMatch(/tính lại ở FE/)
  await closeInspector(page)
  await openInspector(page, 'display'); await page.getByRole('dialog').getByRole('button', { name: 'Hiện tâm khối lượng hàng', exact: true }).click()
  await closeInspector(page); await cameraPreset(page, 'Góc chéo'); await shot('06-center-of-mass')
  await attachJson(testInfo, 'report', { scenes })
  expect(browserErrors).toStrictEqual([])
})

test('hover and double-click focus keep the view; editor shows valid snap and overlap feedback', async ({ page, login, browserErrors }, testInfo) => {
  const { shot, scenes } = shooter(page, testInfo)
  const status = page.locator('[data-editor-status]')
  // Mọi lần đọc tư thế camera hoặc chiếu điểm 3D ra màn hình đều chờ thêm camera đứng yên thật:
  // `settle` có thể thoát giữa lúc camera đang chuyển khi một frame SwiftShader chậm quá 250 ms
  // (overlay báo nghỉ trong khi R3F còn frame chờ vẽ); bản `.mjs` trượt phép so hướng 1/3 lần chạy.
  await login(`${PLANNER_ROUTE}?debug&packages=1000&quality=balanced`); await settle(page)
  await cameraPreset(page, 'Trên'); await settle(page); await waitCameraSettled(page)
  const point = await instancePoint(page, 999), cameraBefore = await sceneSnapshot(page)
  await page.mouse.move(point.x, point.y); await page.waitForTimeout(200)
  expect(await page.locator('canvas').evaluate((el) => (el as HTMLCanvasElement).style.cursor)).toBe('pointer')
  await page.mouse.dblclick(point.x, point.y); await settle(page); await waitCameraSettled(page)
  const cameraAfter = await sceneSnapshot(page)
  expect(cameraBefore.direction.every((v, i) => Math.abs(v - cameraAfter.direction[i]!) < 0.001)).toBeTruthy()
  expect(cameraAfter.target).not.toStrictEqual(cameraBefore.target)
  await button(page, 'Xem toàn xe').click(); await settle(page); await waitCameraSettled(page)
  const cameraReset = await sceneSnapshot(page)
  expect(cameraBefore.target.every((v, i) => Math.abs(v - cameraReset.target[i]!) < 0.001)).toBeTruthy()

  await enterEdit(page); await selectPlacement(page, 'BENCH-01000-01'); await cameraPreset(page, 'Trên'); await settle(page)
  await button(page, 'Tập trung vào kiện').click(); await settle(page); await waitCameraSettled(page)
  let start = await proxyPoint(page), end = await proxyPoint(page, [5.5, 0, 0])
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 10 })
  expect(await status.getAttribute('data-valid')).toBe('true')
  await page.waitForTimeout(250)
  await shot('07-edit-valid-snap', false); await page.mouse.up(); await settle(page)
  start = await proxyPoint(page); end = await proxyPoint(page, [-38, 0, 0])
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 10 })
  await page.waitForTimeout(150)
  expect(await status.getAttribute('data-valid')).toBe('false')
  await shot('08-edit-overlap', false); await page.keyboard.press('Escape'); await page.mouse.up()
  await attachJson(testInfo, 'report', { scenes })
  expect(browserErrors).toStrictEqual([])
})

/** Timeline giữ ô đều nhau (≤ 64 ô) và nhãn neo 3D không tràn khỏi canvas ở khổ hẹp. */
async function checkPlannerLayout(page: Page, login: (route: string) => Promise<void>, testInfo: TestInfo) {
  const { shot, scenes } = shooter(page, testInfo)
  await login(`${PLANNER_ROUTE}?debug&quality=balanced`); await settle(page)
  await page.getByRole('slider', { name: 'Bước xếp', exact: true }).fill('47')
  const cells = page.locator('[data-sequence-cell]')
  expect(await cells.count()).toBeLessThanOrEqual(64)
  const heights = await cells.evaluateAll((items) => items.map((cell) => cell.getBoundingClientRect().height))
  expect(new Set(heights).size).toBe(1)
  await shot(`09-planner-${page.viewportSize()!.width}`)
  const canvas = (await page.locator('canvas').boundingBox())!
  for (const callout of await page.locator('[data-scene-callout]').all()) {
    const bounds = await callout.boundingBox()
    if (bounds) expect(bounds.x >= canvas.x - 1 && bounds.x + bounds.width <= canvas.x + canvas.width + 1, 'world labels stay inside the viewport').toBeTruthy()
  }
  return scenes
}

test.describe('1024 px planner', () => {
  test.use({ viewport: { width: 1024, height: 900 } })

  test('timeline cells and scene labels stay bounded at 1024 px', async ({ page, login, browserErrors }, testInfo) => {
    await attachJson(testInfo, 'report', { scenes: await checkPlannerLayout(page, login, testInfo) })
    expect(browserErrors).toStrictEqual([])
  })
})

test('timeline cells and scene labels stay bounded on tablet and phone', { tag: ['@tablet', '@phone'] }, async ({ page, login, browserErrors }, testInfo) => {
  await attachJson(testInfo, 'report', { scenes: await checkPlannerLayout(page, login, testInfo) })
  expect(browserErrors).toStrictEqual([])
})

test('driver opens the cargo view on phone', { tag: '@phone' }, async ({ page, login, browserErrors }, testInfo) => {
  const { shot, scenes } = shooter(page, testInfo)
  await login('/tai-xe/diem-giao?chuyen=TRIP-2026-0914&debug&quality=balanced', 'driver')
  await button(page, 'Xem vị trí hàng').click(); await shot('10-driver-phone')
  await attachJson(testInfo, 'report', { scenes })
  expect(browserErrors).toStrictEqual([])
})
