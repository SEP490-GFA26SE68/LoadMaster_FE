import type { Page } from '@playwright/test'
import { expect, PLANNER_ROUTE, test } from './fixtures'
import { drawnFrames, R3F_DEPS, waitDemandIdle, type R3FModule } from './viewer-helpers'

/** Tier low vẫn vẽ xe bản gọn (cabin, bánh, khung sườn) và vẽ lại một khung nét khi cảnh nghỉ, rồi nghỉ thật. */
test.use({ deviceScaleFactor: 2 })

function vehicleState(page: Page) {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas:not(.maplibregl-canvas)')!)!.store.getState()
    const cab = s.scene.getObjectByName('vehicle-decoration')
    let wheels = 0
    s.scene.traverse((o) => { if (o.name === 'vehicle-wheels') wheels = (o as unknown as { count: number }).count })
    return { cab: Boolean(cab?.visible), wheels, dpr: s.gl.getPixelRatio(), pending: s.internal.frames }
  }, R3F_DEPS)
}

test('low tier keeps the truck and renders a sharp frame once the scene rests', async ({ page, login, browserErrors }) => {
  await login(`${PLANNER_ROUTE}?debug&quality=low`)
  await page.waitForFunction(() => document.querySelector('[data-viewer-performance]')?.getAttribute('data-quality-tier') === 'low')
  await waitDemandIdle(page)
  const rest = await vehicleState(page)
  expect(rest.cab, 'cabin is drawn at the low tier').toBe(true)
  expect(rest.wheels).toBeGreaterThan(0)
  // Nghỉ: khung nét ở DPR cao hơn 0,5 (thiết bị 2× → 1,5), không còn frame nào được xin
  expect(rest.dpr).toBe(1.5)
  expect(rest.pending).toBe(0)
  await expect(page.locator('[data-viewer-performance]')).toHaveAttribute('data-dpr', '1.5')

  // Kéo xoay: cảnh chạy liên tục về DPR của tier
  const bounds = (await page.locator('canvas:not(.maplibregl-canvas)').boundingBox())!
  const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  let movingDpr = 0
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(cx + Math.sin(i / 3) * 140, cy + Math.cos(i / 3) * 60, { steps: 3 })
    movingDpr = Math.min(movingDpr || Infinity, (await vehicleState(page)).dpr)
  }
  await page.mouse.up()
  expect(movingDpr, 'moving frames use the tier DPR').toBe(0.5)

  // Dừng: lại khung nét, rồi demand loop dừng hẳn (khung nét không tự kích hoạt lại chính nó)
  await waitDemandIdle(page)
  expect((await vehicleState(page)).dpr).toBe(1.5)
  const settled = await drawnFrames(page)
  await page.waitForTimeout(1500)
  expect(await drawnFrames(page), 'no frame after the sharp frame').toBe(settled)
  expect(browserErrors).toStrictEqual([])
})
