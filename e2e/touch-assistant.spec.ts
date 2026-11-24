import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/**
 * Nút "Trợ lý AI" trên thanh dải trời của màn cảm ứng (kho, tài xế): chỉ có khi nhóm `assistant` nối máy chủ, nên spec thay module
 * `backend-config.ts` bằng bản bật đúng nhóm đó (dữ liệu vẫn là kho mẫu, đăng nhập vẫn là form của kho mẫu). Đo thanh của tài xế ở 360 px —
 * màn "Chuyến của tôi" có hàng trên đủ bốn điều khiển 56 px nên nút trợ lý đứng cuối hàng tiêu đề, màn điểm giao thì ở hàng trên — và của kho ở 1.024 px: mọi điều khiển ≥ 56 px, không tràn,
 * không chồng nhau, trang không cuộn ngang, thanh thấp hơn offset 152 px của toast. Mở khung chat: điện thoại phủ cả màn, máy tính bảng neo
 * ngay dưới thanh. Ảnh chụp đính kèm báo cáo; `TOUCH_ASSISTANT_SHOTS` chép thêm ra thư mục đó.
 */
const SHOTS = process.env.TOUCH_ASSISTANT_SHOTS

async function withAssistantOnServer(page: Page) {
  await page.route('**/src/lib/backend-config.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export const BACKEND_FEATURES=['assistant']; export const DRIVER_API_FEATURES=['driver','payroll'];
      export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['assistant']),keycloak:{url:'',realm:'',clientId:''}};
      export const usesBackend=(name)=>name==='assistant'; export const resolveBackendConfig=()=>backendConfig;`,
  }))
}

type Box = { name: string; x: number; y: number; width: number; height: number }

/** Mọi điều khiển bấm được của thanh: tên, hộp; cùng bề rộng cuộn của trang và chiều cao thanh. */
async function measureBar(page: Page) {
  return page.getByRole('banner').evaluate((bar) => {
    const controls: Box[] = [...bar.querySelectorAll('button, a')].map((element) => {
      const rect = element.getBoundingClientRect()
      return { name: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '', x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })
    return { controls, barHeight: bar.getBoundingClientRect().height, scrollWidth: document.documentElement.scrollWidth }
  })
}

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5
}

async function expectTidyBar(page: Page, width: number) {
  const { controls, barHeight, scrollWidth } = await measureBar(page)
  expect(controls.map((control) => control.name)).toContain('Trợ lý AI')
  for (const control of controls) {
    expect(control.height, control.name).toBeGreaterThanOrEqual(56)
    expect(control.width, control.name).toBeGreaterThanOrEqual(56)
    expect(control.x, control.name).toBeGreaterThanOrEqual(0)
    expect(control.x + control.width, control.name).toBeLessThanOrEqual(width)
  }
  for (const [i, a] of controls.entries()) for (const b of controls.slice(i + 1)) expect(overlaps(a, b), `${a.name} / ${b.name}`).toBe(false)
  expect(scrollWidth).toBeLessThanOrEqual(width)
  expect(barHeight).toBeLessThan(152)
  return controls
}

async function shoot(page: Page, name: string, testInfo: import('@playwright/test').TestInfo) {
  const path = SHOTS ? `${SHOTS}/${name}.png` : testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

test('driver bar at 360 px keeps every control at 56 px and opens a full-screen chat', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await withAssistantOnServer(page)
  await login('/tai-xe', 'driver')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến của tôi' })).toBeVisible()
  const list = await expectTidyBar(page, 360)
  // Hàng trên: thoát, ngôn ngữ, chuông, tài khoản; nút trợ lý xuống hàng tiêu đề
  const exit = list.find((control) => control.name === 'Đăng xuất') ?? list[0]
  const assistant = list.find((control) => control.name === 'Trợ lý AI')
  expect(assistant!.y).toBeGreaterThan(exit!.y + 40)
  await shoot(page, 'tai-xe-360', testInfo)

  await page.goto('/tai-xe/diem-giao?chuyen=TRIP-010')
  await expect(page.getByRole('banner').getByRole('button', { name: 'Trợ lý AI' })).toBeVisible()
  const stopBar = await expectTidyBar(page, 360)
  // Màn điểm giao: hàng trên còn chỗ (thoát, trợ lý, ngôn ngữ), số điểm có hàng riêng
  const stopExit = stopBar.find((control) => control.name === 'Về danh sách chuyến') ?? stopBar[0]
  expect(stopBar.find((control) => control.name === 'Trợ lý AI')!.y).toBe(stopExit!.y)
  await shoot(page, 'tai-xe-diem-giao-360', testInfo)

  await page.getByRole('button', { name: 'Trợ lý AI' }).click()
  const dialog = page.getByRole('dialog', { name: 'Lumo' })
  await expect(dialog).toBeVisible()
  // Tờ trượt lên từ đáy: chờ hết chuyển động rồi mới đo
  await expect.poll(() => dialog.evaluate((element) => element.getAnimations().length)).toBe(0)
  const box = (await dialog.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(359)
  expect(box.height).toBeGreaterThanOrEqual(739)
  for (const name of ['Đóng trợ lý', 'Gửi câu hỏi']) {
    const control = (await dialog.getByRole('button', { name }).boundingBox())!
    expect(control.height, name).toBeGreaterThanOrEqual(56)
  }
  await shoot(page, 'tai-xe-khung-chat-360', testInfo)
  expect(browserErrors).toEqual([])
})

test('warehouse bar at 1024 px and the chat docked under it', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await withAssistantOnServer(page)
  await login('/kho', 'warehouse')
  await expect(page.getByRole('banner').getByRole('button', { name: 'Trợ lý AI' })).toBeVisible()
  await expectTidyBar(page, 1024)
  await shoot(page, 'kho-1024', testInfo)

  await page.getByRole('button', { name: 'Trợ lý AI' }).click()
  const dialog = page.getByRole('dialog', { name: 'Lumo' })
  await expect(dialog).toBeVisible()
  // Hết chuyển động mở khung rồi mới đo và chụp
  await expect.poll(() => dialog.evaluate((element) => element.getAnimations().length)).toBe(0)
  const bar = (await page.getByRole('banner').boundingBox())!
  const box = (await dialog.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height)
  expect(box.x + box.width).toBeLessThanOrEqual(1024)
  expect(box.y + box.height).toBeLessThanOrEqual(768)
  await shoot(page, 'kho-khung-chat-1024', testInfo)
  expect(browserErrors).toEqual([])
})
