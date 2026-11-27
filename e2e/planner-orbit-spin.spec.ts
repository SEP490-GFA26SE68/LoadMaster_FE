import type { Page } from '@playwright/test'
import { expect, PLANNER_ROUTE, test } from './fixtures'
import { R3F_DEPS, SCENE_WAIT_MS, waitCameraSettled, waitDemandIdle, waitIdle, type CameraControlsImpl, type R3FModule } from './viewer-helpers'

/** Tư thế camera đọc thẳng R3F: vị trí, tâm nhìn và góc phương vị của camera-controls. */
function cameraPose(page: Page): Promise<{ position: number[]; target: number[]; azimuth: number }> {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas:not(.maplibregl-canvas)')!)!.store.getState()
    const controls = s.controls as CameraControlsImpl
    return { position: s.camera.position.toArray(), target: controls.getTarget(s.camera.position.clone()).toArray(), azimuth: controls.azimuthAngle }
  }, R3F_DEPS)
}

/** Chờ camera quay khỏi góc phương vị `from` (loop đang chạy), không theo cửa sổ thời gian. */
async function waitAzimuthLeaves(page: Page, from: number) {
  await page.waitForFunction(async ({ url, from }) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas:not(.maplibregl-canvas)')!)!.store.getState()
    return Math.abs((s.controls as CameraControlsImpl).azimuthAngle - from) > 0.05
  }, { url: R3F_DEPS, from }, { timeout: SCENE_WAIT_MS })
}

const spinButton = (page: Page) => page.getByRole('button', { name: /^(Xoay một vòng|Dừng xoay)$/ })

test.describe('orbit once', () => {
  test('spins around the view centre, stops on the toggle, Esc and a drag, and a full turn ends on the starting pose', async ({ page, login, browserErrors }) => {
    test.setTimeout(180_000)
    await login(`${PLANNER_ROUTE}?debug`)
    await waitIdle(page)
    await waitCameraSettled(page)
    const button = spinButton(page)
    await expect(button).toHaveAccessibleName('Xoay một vòng')
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    // Bấm → camera quay; bấm lại → dừng giữa chừng và demand loop nghỉ
    let start = await cameraPose(page)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).toHaveAccessibleName('Dừng xoay')
    await waitAzimuthLeaves(page, start.azimuth)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await waitDemandIdle(page)
    const stopped = await cameraPose(page)
    expect(Math.abs(stopped.azimuth - start.azimuth)).toBeGreaterThan(0.05)
    // Góc nghiêng, khoảng cách và tâm nhìn giữ nguyên
    expect(stopped.target.map((v, i) => Math.abs(v - start.target[i]!)).every((d) => d < 1e-3)).toBe(true)
    const dist = (p: typeof start) => Math.hypot(...p.position.map((v, i) => v - p.target[i]!))
    expect(Math.abs(dist(stopped) - dist(start))).toBeLessThan(1e-3)

    // Esc dừng
    start = await cameraPose(page)
    await button.click()
    await waitAzimuthLeaves(page, start.azimuth)
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await waitDemandIdle(page)

    // Người dùng tự kéo camera thì dừng
    start = await cameraPose(page)
    await button.click()
    await waitAzimuthLeaves(page, start.azimuth)
    const canvas = (await page.locator('canvas:not(.maplibregl-canvas)').boundingBox())!
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height * 0.3)
    await page.mouse.down()
    await page.mouse.move(canvas.x + canvas.width / 2 + 60, canvas.y + canvas.height * 0.3, { steps: 4 })
    await page.mouse.up()
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await waitDemandIdle(page)

    // Đủ một vòng: nút tự nhả, loop nghỉ, camera về đúng tư thế lúc bấm
    await waitCameraSettled(page)
    start = await cameraPose(page)
    await button.click()
    await waitAzimuthLeaves(page, start.azimuth)
    await expect(button).toHaveAttribute('aria-pressed', 'false', { timeout: 120_000 })
    await waitDemandIdle(page)
    const end = await cameraPose(page)
    for (const [i, v] of end.position.entries()) expect(Math.abs(v - start.position[i]!)).toBeLessThan(1e-3)
    for (const [i, v] of end.target.entries()) expect(Math.abs(v - start.target[i]!)).toBeLessThan(1e-3)
    expect(browserErrors).toStrictEqual([])
  })

  test.describe('reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } })
    test('has no orbit button', async ({ page, login }) => {
      await login(`${PLANNER_ROUTE}?debug`)
      await waitIdle(page)
      await expect(page.getByRole('button', { name: 'Chi tiết / Hiển thị' })).toBeVisible()
      await expect(spinButton(page)).toHaveCount(0)
    })
  })
})
