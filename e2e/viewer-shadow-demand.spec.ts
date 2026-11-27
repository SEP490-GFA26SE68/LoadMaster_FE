import type { Page } from '@playwright/test'
import { attachJson, expect, PLANNER_ROUTE, test } from './fixtures'
import { drawnFrames, metrics, waitCameraSettled, waitDemandIdle, waitIdle } from './viewer-helpers'

/**
 * Bóng đổ theo yêu cầu (`ShadowOnDemand`, chỉ tier high có bóng): xoay camera hay rê chuột vẽ nhiều khung mà shadow map không vẽ lại
 * lần nào; dời kiện (về đầu, tiến một bước) thì vẽ lại. Số draw call của overlay giữ chi phí khung có lượt bóng nên không đổi khi xoay.
 */
const ROUTE = `${PLANNER_ROUTE}?debug&packages=1000&quality=high`
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/**
 * Chờ scene nghỉ hẳn rồi thêm một nhịp lấy mẫu của overlay (500 ms) để số lần vẽ bóng là của khung cuối. `waitIdle` đầu tiên chờ
 * khung 3D (tải lười) có mặt: `waitCameraSettled` đọc thẳng canvas.
 */
async function restingMetrics(page: Page) {
  await waitIdle(page)
  await waitCameraSettled(page)
  await waitDemandIdle(page, 600)
  await page.waitForTimeout(700)
  await waitIdle(page)
  return metrics(page)
}

const passesOf = async (page: Page) => Number((await metrics(page)).shadowPasses)

test('orbit and hover reuse the shadow map; moving cargo redraws it', async ({ page, login, browserErrors }, testInfo) => {
  await login(ROUTE, 'dispatcher')
  const opened = await restingMetrics(page)
  expect(opened.qualityTier).toBe('high')
  expect(Number(opened.shadowPasses), 'the first frame draws the shadow map').toBeGreaterThan(0)

  const canvas = (await page.locator('canvas:not(.maplibregl-canvas)').boundingBox())!
  const framesBefore = await drawnFrames(page)
  await page.mouse.move(canvas.x + canvas.width * 0.2, canvas.y + canvas.height * 0.5)
  await page.mouse.down()
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(canvas.x + canvas.width * 0.2 + i * 6, canvas.y + canvas.height * 0.5 + Math.sin(i / 3) * 14)
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  for (let i = 0; i <= 20; i++) {
    await page.mouse.move(canvas.x + canvas.width * (0.3 + i * 0.02), canvas.y + canvas.height * 0.55)
    await page.waitForTimeout(30)
  }
  const orbited = await restingMetrics(page)
  const frames = (await drawnFrames(page)) - framesBefore
  expect(frames, 'the orbit drew frames').toBeGreaterThan(5)
  expect(orbited.shadowPasses, 'orbit and hover do not redraw the shadow map').toBe(opened.shadowPasses)
  expect(orbited.drawCalls, 'debug draw calls keep the cost of a frame with a shadow pass').toBe(opened.drawCalls)

  await button(page, 'Về đầu').click()
  await expect.poll(() => passesOf(page), { message: 'moving cargo redraws the shadow map' }).toBeGreaterThan(Number(opened.shadowPasses))
  const stepped = await restingMetrics(page)
  await button(page, 'Tiến một bước').click()
  await expect.poll(() => passesOf(page)).toBeGreaterThan(Number(stepped.shadowPasses))

  await attachJson(testInfo, 'shadow-passes', { opened, orbited, framesDuringOrbit: frames, stepped, final: await metrics(page) })
  expect(browserErrors).toStrictEqual([])
})
