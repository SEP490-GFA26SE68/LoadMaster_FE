import type { Page } from '@playwright/test'
import { attachJson, expect, test } from './fixtures'
import { R3F_DEPS, waitDemandIdle, type R3FModule } from './viewer-helpers'

/**
 * Trang công khai "Phương án mẫu" `/phuong-an-mau`, chạy thật trên SwiftShader: một liên kết kèm tham số mở đúng phương án, đúng chế độ và
 * đúng điểm giao trong khung 3D xoay được, không nhãn MOCK RESULT, không lỗi nào trong console; Home · → · Space điều khiển phần dỡ; khung
 * nghỉ dưới 100 draw call (366 kiện vẫn chung InstancedMesh). Nút "Toàn màn hình" của khung 3D trang giới thiệu mở trang này. Điện thoại 390
 * px: khung 3D ở trên, bộ chọn ở dưới, nút cao 56 px, không cuộn ngang.
 */
test.use({ collectConsoleErrors: true })

const SHARED = '/phuong-an-mau?phuong-an=b&che-do=do&diem=2'
const STAGE = '[data-stage]'
/** Bộ tối ưu mô phỏng chạy trên trình duyệt rồi Three.js mới vẽ khung đầu tiên: SwiftShader chậm. */
const READY_MS = 60_000

/** Số draw call của khung hình vừa vẽ. */
function lastDrawCalls(page: Page): Promise<number> {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    return _roots.get(document.querySelector('canvas')!)!.store.getState().gl.info.render.calls
  }, R3F_DEPS)
}

function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

test.describe('sample plan at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a shared link opens plan B unloading at stop 2 in the live 3D view, the keyboard drives the playback, and the resting frame stays under 100 draw calls', async ({ page, browserErrors }, testInfo) => {
    await page.goto(SHARED)
    await expect(page.locator(STAGE)).toHaveAttribute('data-stage', 'ready', { timeout: READY_MS })
    await expect(page).toHaveTitle('Phương án mẫu · LoadMaster')
    await expect(page.getByRole('button', { name: 'Phương án B — Cân bằng tải trục', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Dỡ hàng', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Điểm 2 · Cửa hàng tiện lợi', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('region', { name: 'Ở điểm 2 · Cửa hàng tiện lợi', exact: true })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('MOCK RESULT')

    // Phím tắt trên cả trang: Home về đầu và dừng, → một kiện, Space phát tiếp
    const slider = page.getByRole('slider', { name: 'Đã dỡ', exact: true })
    await page.keyboard.press('Home')
    await expect(slider).toHaveValue('0')
    await expect(page.getByRole('button', { name: 'Phát', exact: true })).toHaveAttribute('aria-pressed', 'false')
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue('1')

    await waitDemandIdle(page, 500)
    const drawCalls = await lastDrawCalls(page)
    await attachJson(testInfo, 'sample-plan-draw-calls', { drawCalls })
    expect(drawCalls).toBeLessThan(100)

    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'Tạm dừng', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => Number(await slider.inputValue()), { timeout: 20_000 }).toBeGreaterThan(1)

    // Chọn điểm khác: URL đổi theo, phần dỡ bắt đầu lại ở điểm đó
    await page.getByRole('button', { name: 'Điểm 3 · Nhà phân phối', exact: true }).click()
    await expect(page).toHaveURL(/\?phuong-an=b&che-do=do&diem=3$/)
    await expect(page.getByRole('region', { name: 'Ở điểm 3 · Nhà phân phối', exact: true })).toBeVisible()
    expect(browserErrors).toStrictEqual([])
  })

  test('"Toàn màn hình" on the landing 3D view opens the sample page on the same plan', async ({ page }) => {
    await page.goto('/gioi-thieu')
    await page.getByRole('link', { name: 'Mở phương án mẫu toàn màn hình', exact: true }).click()
    await expect(page).toHaveURL(/\/phuong-an-mau\?phuong-an=c&che-do=xep$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Phương án mẫu', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Xếp hàng', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })
})

test('@phone at 390 px the 3D view sits above the controls, buttons are 56 px tall, and the page never scrolls sideways', async ({ page, browserErrors }) => {
  await page.goto(SHARED)
  await expect(page.locator(STAGE)).toHaveAttribute('data-stage', /ready|fallback/, { timeout: READY_MS })
  expect(await scrollsSideways(page)).toBe(false)

  const stage = await page.locator(STAGE).boundingBox()
  const unload = page.getByRole('button', { name: 'Dỡ hàng', exact: true })
  await expect(unload).toHaveAttribute('aria-pressed', 'true')
  const mode = await unload.boundingBox()
  expect(mode!.y).toBeGreaterThan(stage!.y + stage!.height - 1)
  expect(Math.round(mode!.height)).toBeGreaterThanOrEqual(56)
  const stop = await page.getByRole('button', { name: 'Điểm 2 · Cửa hàng tiện lợi', exact: true }).boundingBox()
  expect(Math.round(stop!.height)).toBeGreaterThanOrEqual(56)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.getByRole('link', { name: 'Nhận tư vấn', exact: true }).last()).toBeInViewport()
  expect(await scrollsSideways(page)).toBe(false)
  expect(browserErrors).toStrictEqual([])
})
