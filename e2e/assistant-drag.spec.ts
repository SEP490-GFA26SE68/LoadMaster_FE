import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Khung chat "Trợ lý AI" trong ứng dụng ở 1.366 × 768: neo góc dưới phải khung nhìn (không theo chỗ nút trên thanh điều hướng), trọn trong
 * khung nhìn; kéo đầu khung bằng chuột thì khung dời theo, không ra ngoài và không chui dưới thanh 60 px; đóng mở lại giữ chỗ; Home ở tay
 * nắm về chỗ mặc định. Ở chỗ mặc định khung không che nút "Tạo chuyến" của dải tiêu đề. Nút trợ lý chỉ có khi nhóm `assistant` nối máy chủ, nên spec thay `backend-config.ts` bằng bản bật đúng nhóm đó (dữ
 * liệu, đăng nhập vẫn là kho mẫu) như `touch-assistant.spec.ts`. `ASSISTANT_DRAG_SHOTS` chép ảnh chụp ra thư mục đó.
 */
const SHOTS = process.env.ASSISTANT_DRAG_SHOTS
const VIEW = { width: 1366, height: 768 }

async function withAssistantOnServer(page: Page) {
  await page.route('**/src/lib/backend-config.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export const BACKEND_FEATURES=['assistant']; export const DRIVER_API_FEATURES=['driver','payroll'];
      export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['assistant']),keycloak:{url:'',realm:'',clientId:''}};
      export const usesBackend=(name)=>name==='assistant'; export const resolveBackendConfig=()=>backendConfig;`,
  }))
}

async function shoot(page: Page, name: string, testInfo: TestInfo) {
  const path = SHOTS ? `${SHOTS}/${name}.png` : testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

async function boxOf(page: Page) {
  const box = await page.getByRole('dialog', { name: 'Lumo' }).boundingBox()
  expect(box).not.toBeNull()
  return box!
}

test('the in-app chat opens in the bottom-right corner, drags by its header, stays on screen and keeps its place', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize(VIEW)
  await withAssistantOnServer(page)
  await login('/chuyen', 'dispatcher')
  const create = page.getByRole('link', { name: 'Tạo chuyến' })
  await expect(create).toBeVisible()
  const launcher = page.getByRole('button', { name: 'Trợ lý AI' })
  await launcher.click()
  const dialog = page.getByRole('dialog', { name: 'Lumo' })
  await expect(dialog).toBeVisible()
  // Chờ chuyển động mở xong (dịch 8 px)
  await expect.poll(async () => (await boxOf(page)).y + (await boxOf(page)).height).toBe(VIEW.height - 24)

  const start = await boxOf(page)
  expect(start.x + start.width).toBe(VIEW.width - 24)
  expect(start.y).toBeGreaterThanOrEqual(68)
  // Không che nút hành động của dải tiêu đề
  const createBox = (await create.boundingBox())!
  expect(createBox.y + createBox.height).toBeLessThanOrEqual(start.y)
  await shoot(page, 'lumo-mac-dinh-1366', testInfo)

  // Kéo đầu khung (chỗ chữ "Hỏi đáp…", không phải nút) sang trái 500 px, lên 200 px: đỉnh khung dừng dưới thanh điều hướng
  const head = dialog.getByText('Hỏi đáp về LoadMaster')
  const grab = (await head.boundingBox())!
  await page.mouse.move(grab.x + 10, grab.y + grab.height / 2)
  await page.mouse.down()
  await page.mouse.move(grab.x + 10 - 250, grab.y - 100, { steps: 6 })
  await page.mouse.move(grab.x + 10 - 500, grab.y - 200, { steps: 6 })
  await page.mouse.up()
  const moved = await boxOf(page)
  expect(moved.x).toBeCloseTo(start.x - 500, 0)
  expect(moved.y).toBe(68)
  expect(moved.x + moved.width).toBeLessThanOrEqual(VIEW.width)
  expect(moved.y + moved.height).toBeLessThanOrEqual(VIEW.height)
  await expect(dialog.getByRole('button', { name: 'Về chỗ mặc định' })).toBeVisible()
  await shoot(page, 'lumo-sau-khi-keo-1366', testInfo)

  // Kéo quá mép phải: khung kẹp trong khung nhìn rồi hút vào lề 24 px
  await page.mouse.move(grab.x + 10 - 500, 68 + 30)
  await page.mouse.down()
  await page.mouse.move(grab.x + 10 + 900, 68 + 30, { steps: 8 })
  await page.mouse.up()
  const edge = await boxOf(page)
  expect(edge.x + edge.width).toBe(VIEW.width - 24)

  // Đóng mở lại: giữ chỗ
  await dialog.getByRole('button', { name: 'Đóng trợ lý' }).click()
  await expect(dialog).toBeHidden()
  await launcher.click()
  await expect(dialog).toBeVisible()
  await expect.poll(async () => (await boxOf(page)).y).toBe(68)
  expect((await boxOf(page)).x + edge.width).toBe(VIEW.width - 24)

  // Home ở tay nắm: về chỗ mặc định
  await dialog.getByRole('button', { name: 'Di chuyển khung chat' }).focus()
  await page.keyboard.press('Home')
  await expect.poll(async () => (await boxOf(page)).y + (await boxOf(page)).height).toBe(VIEW.height - 24)
  await expect(dialog.getByRole('button', { name: 'Về chỗ mặc định' })).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(VIEW.width)
  expect(browserErrors).toEqual([])
})
