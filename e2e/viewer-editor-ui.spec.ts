import type { Page } from '@playwright/test'
import type { Vector3Tuple } from 'three'
import { attachJson, attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import {
  cameraPreset, enterEdit, metrics, proxyPoint, renderCameraChange, sceneSnapshot, SOURCE_MODULES, waitIdle, type ViewerMetrics,
} from './viewer-helpers'

const EDITOR_ROUTE = `${PLANNER_ROUTE}?debug&packages=1000&quality=low`

// Như context của bản `.mjs`: camera nhảy thẳng tới đích, không có transition giữa hai lần đo.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const editorStatus = (page: Page) => page.locator('[data-editor-status]')
const position = (page: Page) => editorStatus(page).evaluate((el) => [Number(el.dataset.x), Number(el.dataset.y), Number(el.dataset.z)])

/** Kéo proxy bằng chuột thật; trả số đo lúc đang kéo khi `measure`. */
async function drag(page: Page, delta: Vector3Tuple, { cancel = false, measure = false } = {}) {
  let active: ViewerMetrics | undefined
  const start = await proxyPoint(page), end = await proxyPoint(page, delta)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-editor-status]')?.dataset.dragging === 'true')
  const during = await sceneSnapshot(page)
  expect(during.eventsEnabled, 'captured drag skips cargo raycasts').toBe(false)
  expect(during.controlsEnabled, 'camera cannot orbit during a cargo drag').toBe(false)
  if (measure) {
    for (let i = 1; i <= 24; i++) {
      await page.mouse.move(start.x + (end.x - start.x) * i / 24, start.y + (end.y - start.y) * i / 24)
      await page.waitForTimeout(50)
    }
    active = await metrics(page)
  } else await page.mouse.move(end.x, end.y, { steps: 12 })
  if (cancel) await page.keyboard.press('Escape')
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-editor-status]')?.dataset.dragging === 'false')
  const after = await sceneSnapshot(page)
  expect(after.controlsEnabled).toBe(true)
  expect(after.eventsEnabled).toBe(true)
  return active
}

test('nudge, history, pin, rotation, reset, focus and pointer drags on 1,000 packages', async ({ page, login, browserErrors }, testInfo) => {
  const status = editorStatus(page)
  await login(EDITOR_ROUTE)
  await waitIdle(page)
  expect((await sceneSnapshot(page)).proxy, 'view mode has no draggable proxy').toBe(undefined)
  await button(page, 'Chỉnh sửa').click()
  await page.getByRole('combobox', { name: 'Chọn kiện', exact: true }).selectOption('BENCH-01000-01')
  const initial = await position(page)
  await button(page, 'Tăng X').click()
  expect((await position(page))[0]).toBe(initial[0]! + 1)
  await button(page, 'Hoàn tác').click()
  expect(await position(page)).toStrictEqual(initial)
  await button(page, 'Làm lại').click()
  expect((await position(page))[0]).toBe(initial[0]! + 1)
  await page.keyboard.press('Control+z')
  expect(await position(page)).toStrictEqual(initial)
  await page.keyboard.press('Control+Shift+z')
  expect((await position(page))[0]).toBe(initial[0]! + 1)
  await button(page, 'Ghim').click()
  expect(await button(page, 'Tăng X').isEnabled()).toBe(false)
  await button(page, 'Bỏ ghim').click()
  await button(page, 'WLH').click()
  expect(await status.innerText()).toMatch(/Không thể xoay/)
  expect(await status.getAttribute('data-orientation')).toBe('LWH')
  await button(page, 'HWL').click()
  expect(await status.getAttribute('data-orientation')).toBe('HWL')
  await button(page, 'Khôi phục kiện này').click()
  expect(await status.getAttribute('data-orientation')).toBe('LWH')
  expect(await position(page)).toStrictEqual(initial)
  await button(page, 'Tăng Z').click()
  expect(await status.innerText(), 'floating lift is a SUPPORT_BELOW_MIN warning from the domain').toMatch(/tỷ lệ đỡ đáy/)
  await button(page, 'Khôi phục mọi chỉnh sửa').click()
  await button(page, 'Giữ chỉnh sửa').click()
  expect((await position(page))[2]).toBe(initial[2]! + 1)
  await button(page, 'Khôi phục mọi chỉnh sửa').click()
  await button(page, 'Khôi phục tất cả').click()
  expect(await position(page)).toStrictEqual(initial)
  await button(page, 'Hoàn tác').click()
  expect((await position(page))[2]).toBe(initial[2]! + 1)
  await button(page, 'Làm lại').click()

  // Bản `.mjs` chỉ `waitIdle` sau mỗi thao tác, có thể đọc tư thế trước khi effect của CameraRig chạy.
  // Chờ tư thế mới được vẽ (renderCameraChange) để kiểm tra đúng ý bước này: tập trung vào kiện giữ
  // hướng nhìn và dời đích camera.
  await renderCameraChange(page, () => cameraPreset(page, 'Trên'))
  await waitIdle(page)
  const beforeFocus = await sceneSnapshot(page)
  await renderCameraChange(page, () => button(page, 'Tập trung vào kiện').click())
  await waitIdle(page)
  const afterFocus = await sceneSnapshot(page)
  expect(beforeFocus.direction.every((value, i) => Math.abs(value - afterFocus.direction[i]!) < 0.001)).toBeTruthy()
  expect(afterFocus.target).not.toStrictEqual(beforeFocus.target)

  await button(page, 'Hút khi kéo: Bật').click()
  const activeDrag = await drag(page, [-2, 0, 0], { measure: true })
  const moved = await position(page)
  expect(moved[0]! < initial[0]!, 'direct drag commits a move').toBeTruthy()
  await button(page, 'Hoàn tác').click()
  expect(await position(page), 'one complete gesture is exactly one command').toStrictEqual(initial)
  await drag(page, [-2, 0, 0], { cancel: true })
  expect(await position(page), 'Escape cancels without a command').toStrictEqual(initial)
  // Kiện cuối cách cửa ~21 cm trong fixture cm: kéo 40 cm chắc chắn vượt cửa sau.
  await drag(page, [40, 0, 0])
  expect(await status.innerText()).toMatch(/Không thể đặt/)
  expect(await position(page), 'invalid drop restores original placement').toStrictEqual(initial)
  await drag(page, [-30, 0, 0])
  expect(await status.innerText()).toMatch(/chồng lấn/)
  expect(await position(page)).toStrictEqual(initial)
  const framesAfterDrop = (await metrics(page)).renderedFrames
  await page.waitForTimeout(1800)
  const resting = await metrics(page)
  await page.waitForTimeout(1100)
  expect((await metrics(page)).renderedFrames, 'editor also sleeps when idle').toBe(resting.renderedFrames)
  await attachJson(testInfo, 'report', { activeDrag, gestures: { initial, moved, framesAfterDrop, scene: await sceneSnapshot(page) } })
  await attachScreenshot(page, testInfo, 'desktop')
  expect(browserErrors).toStrictEqual([])
})

test('edit mode keeps a fixed mesh budget from 132 to 1,000 packages', async ({ page, login, browserErrors }, testInfo) => {
  const benchmarks = []
  for (const count of [132, 300, 500, 1000]) {
    const route = `${PLANNER_ROUTE}?debug&packages=${count}&quality=low`
    await (count === 132 ? login(route) : page.goto(route))
    await waitIdle(page)
    const viewMetrics = await metrics(page)
    await button(page, 'Chỉnh sửa').click()
    await page.waitForFunction((previous) => Number(document.querySelector<HTMLElement>('[data-viewer-performance]')?.dataset.renderedFrames) > previous,
      Number(viewMetrics.renderedFrames))
    await waitIdle(page)
    const editMetrics = await metrics(page), scene = await sceneSnapshot(page)
    const cargo = scene.instances.filter((mesh) => mesh.name.startsWith('cargo-'))
    expect(Number(editMetrics.drawCalls)).toBeLessThan(100)
    expect(cargo.length).toBe(2)
    expect(cargo.every((mesh) => mesh.count === count)).toBeTruthy()
    expect(scene.instances.find((mesh) => mesh.name === 'snap-surfaces')?.count).toBe(3)
    expect(scene.instances.find((mesh) => mesh.name === 'overlap-regions')?.count).toBe(4)
    expect(scene.meshes).toBeLessThan(50)
    benchmarks.push({ count, view: viewMetrics, edit: editMetrics, scene })
  }
  await attachJson(testInfo, 'report', { benchmarks })
  expect(browserErrors).toStrictEqual([])
})

test('touch editing uses 56px controls, a full-width scene and captured touch drags', { tag: ['@tablet', '@phone'] }, async ({ page, login, browserErrors }, testInfo) => {
  const viewport = page.viewportSize()!, status = editorStatus(page)
  await login(EDITOR_ROUTE)
  // Bản `.mjs` so với vị trí đọc ở lượt desktop; trang mới chưa có draft nên đó là vị trí nguồn.
  const initialX = await page.evaluate(async (url) => {
    const { benchmarkScene } = (await import(url)) as typeof import('@/test/scene')
    return benchmarkScene(1000).placementById.get('BENCH-01000-01')!.position.x
  }, SOURCE_MODULES.scene)
  await enterEdit(page)
  await page.getByRole('combobox', { name: 'Chọn kiện', exact: true }).selectOption('BENCH-01000-01')
  const nudge = button(page, 'Tăng X')
  await nudge.tap()
  expect(await status.getAttribute('data-x')).toBe(String(initialX + 1))
  await button(page, 'Hoàn tác').tap()
  const nudgeBounds = (await nudge.boundingBox())!
  expect(nudgeBounds.height >= 56 && nudgeBounds.width >= 56).toBeTruthy()
  const sceneBounds = (await page.locator('canvas').boundingBox())!
  expect(sceneBounds.width >= viewport.width - 20 && sceneBounds.height >= 192).toBeTruthy()
  if (testInfo.project.name === 'tablet') {
    await cameraPreset(page, 'Trên')
    await button(page, 'Tập trung vào kiện').tap()
    await button(page, 'Hút khi kéo: Bật').tap()
    await button(page, 'Tập trung vào kiện').tap()
    await waitIdle(page)
    const start = await proxyPoint(page), end = await proxyPoint(page, [-2, 0, 0])
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y, id: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: end.x, y: end.y, id: 1 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForFunction((x) => Number(document.querySelector<HTMLElement>('[data-editor-status]')?.dataset.x) < x, initialX)
    await button(page, 'Hoàn tác').tap()
    expect(await status.getAttribute('data-x')).toBe(String(initialX))
  }
  await page.getByRole('link', { name: 'Quay lại chuyến', exact: true }).waitFor()
  await attachScreenshot(page, testInfo, `touch-${viewport.width}`)
  await attachJson(testInfo, 'report', { sceneBounds, nudgeBounds })
  expect(browserErrors).toStrictEqual([])
})
