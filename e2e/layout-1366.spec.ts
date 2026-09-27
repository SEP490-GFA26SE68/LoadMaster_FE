import type { Page } from '@playwright/test'
import { attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'

/**
 * LM-095 (D-54): màn điều phối ở 1.366 × 768 và 1.600 × 1.000 — trang không cuộn ngang, không vùng nào cuộn ngang, không ô
 * hay nhãn nào bị cắt ngang (kể cả cắt bằng dấu ba chấm), nhãn giới hạn số dòng không bị cắt ở dòng cuối.
 * `E2E_SCREENSHOT_DIR=docs/screenshots/lm-095/after` ghi lại bộ ảnh của issue. Kiểm mềm (`expect.soft`) để một lần chạy báo đủ mọi màn.
 */
test.use({ collectConsoleErrors: true })

const SIZES = [
  { width: 1366, height: 768 },
  { width: 1600, height: 1000 },
] as const

/** Chữ bị cắt và vùng cuộn ngang trên cả trang (bỏ qua `sr-only` và khung 3D). */
function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > root.clientWidth) problems.push(`page scrolls sideways: ${root.scrollWidth} > ${root.clientWidth}`)
    for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
      if (!element.offsetParent || element.closest('.sr-only, canvas')) continue
      const style = getComputedStyle(element)
      const label = `${element.tagName.toLowerCase()} "${element.innerText.trim().slice(0, 48)}"`
      if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && element.scrollWidth > element.clientWidth + 1) {
        problems.push(`scrolls sideways ${element.scrollWidth} > ${element.clientWidth}: ${label}`)
      }
      const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      if (!ownText) continue
      if (element.scrollWidth > element.clientWidth + 1) problems.push(`cut ${element.scrollWidth} > ${element.clientWidth}: ${label}`)
      if (style.webkitLineClamp !== 'none' && element.scrollHeight > element.clientHeight + 1) problems.push(`cut after the last line: ${label}`)
    }
    return problems
  })
}

type Screen = { name: string; route: string; ready: (page: Page) => Promise<void> }

const SCREENS: readonly Screen[] = [
  {
    name: 'trip-detail',
    route: '/chuyen/TRIP-2026-0914',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Kiện hàng', exact: true })).toBeVisible()
      await expect(page.getByRole('row').filter({ hasText: 'PKG-006' })).toBeVisible()
    },
  },
  {
    name: 'vehicle-detail',
    route: '/doi-xe/VEHICLE-002',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Vật cản trong thùng', exact: true })).toBeVisible()
      await expect(page.getByLabel('Loại OBS-002', { exact: true })).toBeVisible()
      await expect(page.locator('canvas')).toBeVisible()
    },
  },
  {
    // V2: ghi chú bảo dưỡng dài (VEHICLE-008) xuống hai dòng dưới badge thay vì bị cắt
    name: 'fleet',
    route: '/doi-xe',
    ready: async (page) => {
      await expect(page.getByRole('group', { name: 'Bảo dưỡng', exact: true })).toBeVisible()
      await expect(page.getByRole('row', { name: /VEHICLE-008/ })).toContainText('Thay má phanh')
    },
  },
  {
    name: 'planner',
    route: PLANNER_ROUTE,
    ready: async (page) => {
      await expect(page.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toBeVisible()
      await expect(page.locator('canvas')).toBeVisible()
    },
  },
  {
    name: 'dashboard',
    route: '/',
    ready: async (page) => {
      await expect(page.getByRole('heading', { name: 'Chuyến trong kỳ', exact: true })).toBeVisible()
      await expect(page.getByRole('cell').filter({ hasText: /^Tuyến .+TRIP-/ }).first()).toBeVisible()
    },
  },
]

for (const size of SIZES) {
  test(`dispatcher screens fit ${size.width} × ${size.height} without cut text or sideways scrolling`, async ({ page, login, browserErrors }, testInfo) => {
    await page.setViewportSize(size)
    await login('/', 'admin')
    for (const screen of SCREENS) {
      await page.goto(screen.route)
      await screen.ready(page)
      // Chuột còn đứng chỗ nút đăng nhập thì biểu đồ hiện tooltip trong ảnh: đưa ra góc trống
      await page.mouse.move(0, 0)
      await attachScreenshot(page, testInfo, `${screen.name}-${size.width}`)
      expect.soft(await layoutProblems(page), `${screen.name} at ${size.width} px`).toStrictEqual([])
    }
    expect(browserErrors).toStrictEqual([])
  })
}

/**
 * Cuộn bằng bánh xe chuột thật, không bằng `scrollIntoView`: Playwright cuộn được cả vùng `overflow-hidden` bằng code, nên các
 * test khác không thấy khi người dùng không lăn được (khung dọc thiếu `min-h-0`, bảng nhật ký bị co trong cột flex, bảng `sr-only`
 * của biểu đồ kéo cả trang dài ra). Trang không bao giờ tự cuộn: thanh điều hướng luôn ở mép trên.
 */
const WHEEL_SCREENS: readonly Screen[] = [
  { name: 'dashboard', route: '/', ready: async (page) => { await expect(page.getByRole('group', { name: 'Chuyến hoàn thành', exact: true })).toBeVisible() } },
  { name: 'trip-detail', route: '/chuyen/TRIP-2026-0914', ready: async (page) => { await expect(page.getByRole('heading', { name: 'Kiện hàng', exact: true })).toBeVisible() } },
  { name: 'vehicle-detail', route: '/doi-xe/VEHICLE-002', ready: async (page) => { await expect(page.getByRole('heading', { name: 'Vật cản trong thùng', exact: true })).toBeVisible() } },
  { name: 'fleet', route: '/doi-xe', ready: async (page) => { await expect(page.getByRole('row', { name: /VEHICLE-008/ })).toBeVisible() } },
  { name: 'audit', route: '/nhat-ky', ready: async (page) => { await expect(page.getByRole('row')).not.toHaveCount(0) } },
  { name: 'packages', route: '/kien-hang', ready: async (page) => { await expect(page.getByRole('row', { name: /RPK-00/ }).first()).toBeVisible() } },
  { name: 'labels', route: '/kien-hang/nhan', ready: async (page) => { await expect(page.getByRole('img', { name: /^Mã QR LM-/ }).first()).toBeVisible() } },
]

test('app-shell screens scroll with the mouse wheel at 1366 × 768 and the page itself stays put', async ({ page, login }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await login('/', 'admin')
  for (const screen of WHEEL_SCREENS) {
    await page.goto(screen.route)
    await screen.ready(page)
    // Vùng cuộn của màn là khối ngay sau thanh tiêu đề
    const region = page.locator('header:has(h1) + *')
    const bottomOfLastChild = () => region.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
    expect.soft(await bottomOfLastChild(), `${screen.name}: content taller than the screen`).toBe(false)
    await page.mouse.move(683, 500)
    await page.mouse.wheel(0, 5000)
    await expect.poll(bottomOfLastChild, { message: `${screen.name}: wheel reaches the end` }).toBe(true)
    const pageScroll = await page.evaluate(() => ({ tall: document.documentElement.scrollHeight > innerHeight, y: scrollY, navTop: document.querySelector('header')!.getBoundingClientRect().top }))
    expect.soft(pageScroll, screen.name).toStrictEqual({ tall: false, y: 0, navTop: 0 })
  }
})
