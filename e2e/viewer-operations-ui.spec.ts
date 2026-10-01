import type { Page } from '@playwright/test'
import { attachJson, attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import {
  cameraPreset, closeInspector, focusStop, hasSceneObject, instancePoint, metrics, openInspector, sceneSnapshot, selectedPlacementId,
  settle as settleFor, SOURCE_MODULES, visibleCargo, waitCameraSettled, type ViewerMetrics,
} from './viewer-helpers'

const OPERATIONS_ROUTE = `${PLANNER_ROUTE}?debug&packages=1000&quality=low`

test.use({ collectConsoleErrors: true })

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const settle = (page: Page) => settleFor(page, 650)

/** Kéo xoay camera liên tục và lấy số đo khi scene đang chuyển động. */
async function cameraMotion(page: Page) {
  const r = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(r.x + r.width * 0.18, r.y + r.height * 0.5)
  await page.mouse.down()
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(r.x + r.width * 0.18 + i * 3, r.y + r.height * 0.5 + Math.sin(i / 3) * 12)
    await page.waitForTimeout(60)
  }
  const active = await metrics(page)
  await page.mouse.up()
  return active
}

test('loading, unloading advisories, blockers and approval wording on 1,000 packages', async ({ page, login, browserErrors }, testInfo) => {
  await login(OPERATIONS_ROUTE)
  await settle(page)
  expect(await page.locator('[data-experience="planner"]').count()).toBe(1)
  expect(Number(await page.locator('[data-timeline-bins]').getAttribute('data-timeline-bins'))).toBeLessThanOrEqual(80)
  await button(page, 'Về đầu').click(); await settle(page)
  expect(await visibleCargo(page)).toStrictEqual({ 'cargo-opaque': 1, 'cargo-dim': 1 })
  await button(page, 'Tiến một bước').click(); await settle(page)
  expect((await visibleCargo(page))['cargo-opaque']).toBe(2)
  const loadingSlider = page.getByRole('slider', { name: 'Bước xếp', exact: true })
  await loadingSlider.fill('1000'); await cameraPreset(page, 'Trên'); await settle(page)
  // Điểm click chiếu từ camera: chờ camera đứng yên thật (xem waitCameraSettled), không chỉ overlay báo nghỉ.
  await waitCameraSettled(page)
  const point = await instancePoint(page, 999)
  await page.mouse.click(point.x, point.y)
  expect(await selectedPlacementId(page)).toBe('BENCH-01000-01')
  await openInspector(page, 'display')
  await button(page, 'Hiện tâm khối lượng hàng').click(); await settle(page)
  await closeInspector(page)
  expect(await hasSceneObject(page, 'cargo-center-of-mass')).toBe(true)

  await button(page, 'Dỡ hàng').click(); await settle(page)
  await openInspector(page, 'operations')
  // Thứ tự dỡ đến từ kết quả (LM-036): không còn chữ "gợi ý"
  const operationsText = await page.getByRole('dialog').innerText()
  expect(operationsText).toMatch(/Thứ tự dỡ/)
  expect(operationsText).not.toMatch(/gợi ý/)
  await closeInspector(page)
  await button(page, 'Tiến một bước').click(); await settle(page)
  let cargo = await visibleCargo(page)
  expect(cargo['cargo-opaque'] + cargo['cargo-dim']).toBe(999)
  await focusStop(page, 2); await settle(page)
  cargo = await visibleCargo(page)
  expect(cargo['cargo-opaque'] + cargo['cargo-dim'], 'prior stop is removed from the simulation').toBe(750)
  // Kiện điểm 2 đầu tiên trong thứ tự dỡ của kết quả mà kiện giao sau còn trên xe che kín lối dỡ (kiểm LIFO của domain)
  const blockedIndex = await page.evaluate(async ({ scene, operations }) => {
    const { benchmarkScene } = (await import(scene)) as typeof import('@/test/scene')
    const { createLifoIndex, unloadSequence } = (await import(operations)) as typeof import('@/features/viewer3d/operations/unloading')
    const plan = benchmarkScene(1000), { ordered } = unloadSequence(plan.placements), index = createLifoIndex(plan.placements)
    return ordered.findIndex((p, i) => p.stop === 2 &&
      index.blockage(p, new Set(ordered.slice(0, i).map((q) => q.id)))?.code === 'LIFO_BLOCKED')
  }, SOURCE_MODULES)
  expect(blockedIndex).toBeGreaterThanOrEqual(0)
  const unloadSlider = page.getByRole('slider', { name: 'Đã dỡ', exact: true })
  await unloadSlider.fill(String(blockedIndex)); await button(page, 'Tiến một bước').click(); await settle(page)
  expect(await unloadSlider.inputValue(), 'LIFO_BLOCKED pauses the simulation').toBe(String(blockedIndex))
  await page.getByText('Lối dỡ bị che kín · Đã tạm dừng', { exact: true }).waitFor()
  cargo = await visibleCargo(page)
  expect(cargo['cargo-hull'], 'blocker warning hull survives low tier').toBeGreaterThan(0)
  await openInspector(page, 'operations')
  const blockerPanel = page.getByRole('region', { name: 'Kiện chắn lối dỡ', exact: true })
  expect(await blockerPanel.innerText()).toMatch(/kiện giao sau che kín lối dỡ/)
  const blockerName = await blockerPanel.getByRole('button').first().innerText()
  await blockerPanel.getByRole('button').first().click(); await settle(page)
  expect(await selectedPlacementId(page)).toBe(blockerName.split(' · ')[0])
  expect(await unloadSlider.inputValue(), 'inspecting a blocker cannot replace the unload target').toBe(String(blockedIndex))
  await button(page, 'Quay lại kiện cần dỡ').click(); await settle(page)

  await button(page, 'Duyệt phương án').click()
  const approval = page.getByRole('dialog')
  // Fixture có đúng một cặp kiện đổi điểm giao để tạo ca LIFO: thứ tự xếp lệch điểm giao và Duyệt báo theo kiểm LIFO của domain
  expect(await approval.innerText()).toMatch(/Thứ tự xếp chưa phù hợp thứ tự điểm giao/)
  expect(await approval.innerText()).toMatch(/1 kiện bị kiện giao sau che kín lối dỡ \(kiểm tra LIFO\)/)
  // LM-037: Duyệt không kiểm tải trục khi chưa có số liệu tin cậy (Spec 7.10).
  expect(await approval.innerText()).not.toMatch(/Trục trước|Trục sau|tải trục/)
  expect(await approval.innerText()).not.toMatch(/LIFO hoàn toàn hợp lệ|Tuân thủ thứ tự dỡ/)
  await button(page, 'Huỷ').click()
  await attachScreenshot(page, testInfo, 'planner-unloading')
  await attachJson(testInfo, 'report', { selected: await selectedPlacementId(page), cargo, metrics: await metrics(page) })
  expect(browserErrors).toStrictEqual([])
})

test('camera orbit keeps draw calls and cargo instances bounded; balanced/high add the hull mesh', async ({ page, login, browserErrors }, testInfo) => {
  const benchmarks = []
  for (const count of [132, 300, 500, 1000]) {
    const route = `${PLANNER_ROUTE}?debug&packages=${count}&quality=low`
    await (count === 132 ? login(route) : page.goto(route)); await settle(page)
    const active = await cameraMotion(page)
    await settle(page)
    const resting = await metrics(page), scene = await sceneSnapshot(page)
    expect(Number(resting.drawCalls)).toBeLessThan(100)
    expect(scene.instances.filter((mesh) => mesh.name.startsWith('cargo-')).every((mesh) => mesh.count === count)).toBeTruthy()
    benchmarks.push({ count, active, resting, meshes: scene.meshes })
  }
  const tiers: Record<string, ViewerMetrics> = {}
  for (const tier of ['balanced', 'high']) {
    await page.goto(`${PLANNER_ROUTE}?debug&packages=1000&quality=${tier}`); await settle(page)
    const sample = tiers[tier] = await metrics(page)
    expect(sample.qualityTier).toBe(tier)
    expect((await sceneSnapshot(page)).instances.filter((mesh) => mesh.name.startsWith('cargo-')).length).toBe(3)
  }
  await attachJson(testInfo, 'report', { benchmarks, ...tiers })
  expect(browserErrors).toStrictEqual([])
})

test('warehouse isolates the current package and advances after confirmation', async ({ page, login, browserErrors }, testInfo) => {
  // Phiên kho của chuyến seed (LM-060, LM-086) bắt đầu ở bước 1 của bản đã duyệt: kiện hiện tại đậm, kiện kế tiếp mờ.
  await login('/kho?chuyen=TRIP-2026-0914&debug&quality=low', 'warehouse'); await settle(page)
  expect(await page.locator('[data-experience="warehouse"]').count()).toBe(1)
  expect(await visibleCargo(page)).toStrictEqual({ 'cargo-opaque': 1, 'cargo-dim': 1 })
  await page.getByRole('combobox', { name: 'Góc nhìn thùng xe', exact: true }).selectOption('cua-sau')
  await button(page, 'Chỉ kiện này').click(); await settle(page)
  expect(await visibleCargo(page)).toStrictEqual({ 'cargo-opaque': 1, 'cargo-dim': 0 })
  await button(page, 'Hiện xung quanh').click()
  const second = await page.evaluate(async (url) => {
    const { seedScene } = (await import(url)) as typeof import('@/test/scene')
    return (await seedScene()).placements.find((placement) => placement.step === 2)!.id
  }, SOURCE_MODULES.scene)
  await button(page, 'Xác nhận đã xếp').click()
  await expect(page.getByRole('heading', { level: 1, name: second, exact: true })).toBeVisible()
  await settle(page)
  expect(await visibleCargo(page)).toStrictEqual({ 'cargo-opaque': 2, 'cargo-dim': 1 })

  // LM-100: kiện báo thiếu không lên xe — sang bước 3, khung 3D chỉ còn kiện bước 1 và kiện hiện tại, không vẽ kiện thiếu như đã xếp
  await button(page, 'Kiện này không có ở kho').click()
  await page.getByRole('dialog', { name: `Ghi thiếu ${second}?` }).getByRole('button', { name: 'Ghi thiếu', exact: true }).click()
  await expect(page.getByText('Bước 3 / 132', { exact: true })).toBeVisible()
  await settle(page)
  expect(await visibleCargo(page)).toStrictEqual({ 'cargo-opaque': 2, 'cargo-dim': 1 })
  await attachJson(testInfo, 'report', { scene: await sceneSnapshot(page), metrics: await metrics(page) })
  await attachScreenshot(page, testInfo, 'warehouse')
  expect(browserErrors).toStrictEqual([])
})

test.describe('touch', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  test('driver loads Three.js only on demand; planner drawer works by touch', { tag: ['@tablet', '@phone'] }, async ({ page, login, browserErrors }, testInfo) => {
    const viewport = page.viewportSize()!
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    // Chuyến đã xếp xong của tài xế demo (LM-087); `debug&packages` thay khung 3D bằng fixture benchmark như trước
    await login('/tai-xe/diem-giao?chuyen=TRIP-010&debug&packages=1000&quality=low', 'driver')
    await button(page, 'Xem vị trí hàng').waitFor()
    expect(await page.locator('canvas').count()).toBe(0)
    expect(requests.some((url) => /@react-three|three\.module|three\.core/.test(url)), 'driver 2D must not fetch Three.js').toBe(false)
    await button(page, 'Xem vị trí hàng').tap(); await settle(page)
    expect(await page.locator('[data-experience="driver"]').count()).toBe(1)
    expect(await button(page, 'Chỉnh sửa').count()).toBe(0)
    const before = await visibleCargo(page)
    await button(page, 'Tiến một bước').tap(); await settle(page)
    const after = await visibleCargo(page)
    expect(after['cargo-opaque'] + after['cargo-dim']).toBe(before['cargo-opaque'] + before['cargo-dim'] - 1)
    const bounds = (await page.locator('canvas').boundingBox())!
    expect(bounds.width >= viewport.width - 10 && bounds.height >= 192).toBeTruthy()
    const driver = { bounds, metrics: await metrics(page), scene: await sceneSnapshot(page) }
    await attachScreenshot(page, testInfo, `driver-${viewport.width}`)
    await button(page, 'Đóng 3D').tap()
    expect(await page.locator('canvas').count()).toBe(0)
    await button(page, 'Bắt đầu giao').waitFor()

    // Tài xế không mở được Planner (403 từ LM-084): đăng xuất rồi vào lại bằng tài khoản điều phối
    await page.evaluate(() => sessionStorage.clear())
    await login(OPERATIONS_ROUTE); await settle(page)
    await button(page, 'Dỡ hàng').tap()
    await button(page, 'Chi tiết / Hiển thị').tap()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Hiển thị', exact: true }).tap()
    await drawer.getByRole('button', { name: 'Hiện tâm khối lượng hàng', exact: true }).tap()
    await drawer.getByRole('button', { name: 'Theo khối lượng', exact: true }).tap()
    await drawer.getByRole('button', { name: 'Đóng', exact: true }).tap()
    expect(await page.getByRole('dialog').count()).toBe(0)
    await attachScreenshot(page, testInfo, `planner-${viewport.width}`)
    await attachJson(testInfo, 'report', { driver, planner: { bounds: await page.locator('canvas').boundingBox() } })
    expect(browserErrors).toStrictEqual([])
  })
})
