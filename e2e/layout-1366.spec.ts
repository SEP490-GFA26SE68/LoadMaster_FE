import type { Page } from '@playwright/test'
import type { Role } from '@/types/user'
import { attachJson, attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'

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
    // FE-3b-06: thẻ kiện của Tra cứu kiện — mã và điểm đến xuống dòng, không cắt
    name: 'lookup',
    route: '/tra-cuu-kien?ma=PK-0054',
    ready: async (page) => {
      await expect(page.getByRole('region', { name: 'Kiện PB-HUE-2609-01', exact: true })).toBeVisible()
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
    await login('/', 'dispatcher')
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
 * Mỗi màn mở bằng vai trò dùng nó (FE-0-01: không còn vai trò toàn quyền). Màn chỉ đọc kho seed nên đổi vai trò bằng cách tải lại.
 */
const WHEEL_SCREENS: readonly (Screen & { role: Role })[] = [
  { name: 'dashboard', role: 'dispatcher', route: '/', ready: async (page) => { await expect(page.getByRole('group', { name: 'Chuyến hoàn thành', exact: true })).toBeVisible() } },
  { name: 'trip-detail', role: 'dispatcher', route: '/chuyen/TRIP-2026-0914', ready: async (page) => { await expect(page.getByRole('heading', { name: 'Kiện hàng', exact: true })).toBeVisible() } },
  { name: 'vehicle-detail', role: 'dispatcher', route: '/doi-xe/VEHICLE-002', ready: async (page) => { await expect(page.getByRole('heading', { name: 'Vật cản trong thùng', exact: true })).toBeVisible() } },
  { name: 'fleet', role: 'dispatcher', route: '/doi-xe', ready: async (page) => { await expect(page.getByRole('row', { name: /VEHICLE-008/ })).toBeVisible() } },
  // FE-0-06: hai màn kiện là của điều phối viên
  { name: 'packages', role: 'dispatcher', route: '/kien-hang', ready: async (page) => { await expect(page.getByRole('row', { name: /PK-00/ }).first()).toBeVisible() } },
  { name: 'labels', role: 'dispatcher', route: '/kien-hang/nhan?kien=PK-0001,PK-0054,PK-0063,PK-0078', ready: async (page) => { await expect(page.getByRole('img', { name: /^Mã QR LM-/ }).first()).toBeVisible() } },
  { name: 'audit', role: 'systemAdmin', route: '/nhat-ky', ready: async (page) => { await expect(page.getByRole('row')).not.toHaveCount(0) } },
  { name: 'users', role: 'systemAdmin', route: '/nguoi-dung', ready: async (page) => { await expect(page.getByRole('row', { name: /Nguyễn Thanh Tùng/ })).toBeVisible() } },
]

test('app-shell screens scroll with the mouse wheel at 1366 × 768 and the page itself stays put', async ({ page, login }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  let signedInAs: Role | undefined
  for (const screen of WHEEL_SCREENS) {
    if (screen.role !== signedInAs) {
      // Đổi vai trò: bỏ phiên của tab rồi đăng nhập lại (đăng nhập ở gốc `/` mở màn chính của vai trò, chưa phải màn cần đo)
      if (signedInAs !== undefined) await page.evaluate(() => sessionStorage.clear())
      await login('/', screen.role)
      signedInAs = screen.role
    }
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

/**
 * FE-0-04: thanh điều hướng theo vai trò ở 1.366 px — hai vai trò nhiều mục nhất (điều phối viên và quản lý công ty, mỗi vai trò 5 mục), cả hai
 * ngôn ngữ. Mục còn đủ chữ (dưới 1.340 px mới rút về icon), khay mục không cuộn ngang, không chạm cụm nút bên phải, trang không cuộn
 * ngang; chỉ báo kính bám mục đang rê và về mục đang mở khi con trỏ rời thanh. Số đo đính kèm báo cáo (`nav-1366`).
 */
const NAV_AT_1366: readonly { role: Role; labels: Readonly<Record<'vi' | 'en', readonly string[]>> }[] = [
  {
    role: 'dispatcher',
    labels: { vi: ['Chuyến hàng', 'Kho kiện', 'Đơn hàng', 'Đội xe', 'Bảng điều khiển'], en: ['Trips', 'Package pool', 'Orders', 'Fleet', 'Dashboard'] },
  },
  {
    role: 'manager',
    labels: { vi: ['Bảng điều khiển', 'Đơn hàng', 'Kho kiện', 'Chuyến hàng', 'Đội xe'], en: ['Dashboard', 'Orders', 'Package pool', 'Trips', 'Fleet'] },
  },
]

function measureNav(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('header')!
    const nav = header.querySelector('nav')!
    const links = [...nav.querySelectorAll<HTMLElement>('a')]
    const actions = header.lastElementChild!.getBoundingClientRect()
    return {
      labels: links.map((link) => link.innerText.trim()),
      cutLabels: links.filter((link) => link.scrollWidth > link.clientWidth + 1).map((link) => link.innerText.trim()),
      navWidth: Math.round(nav.getBoundingClientRect().width),
      itemsWidth: Math.round(links.at(-1)!.getBoundingClientRect().right - links[0]!.getBoundingClientRect().left),
      navOverflow: nav.scrollWidth - nav.clientWidth,
      gapToActions: Math.round(actions.left - nav.getBoundingClientRect().right),
      actionsRight: Math.round(actions.right),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

/** Chỉ báo kính đang nằm trên mục nào (theo `left` / `width` hook đặt), `null` khi đang giấu. */
function glassOn(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('header nav')!
    const follow = nav.querySelector<HTMLElement>('.glass-follow')!
    if (follow.hidden) return null
    const link = [...nav.querySelectorAll<HTMLElement>('a')]
      .find((item) => `${item.offsetLeft}px` === follow.style.left && `${item.offsetWidth}px` === follow.style.width)
    return link?.getAttribute('aria-label') ?? 'no item'
  })
}

test('the nav bar of the roles with the most items fits 1366 px in both languages and the glass indicator follows the pointer (FE-0-04)', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const measures: Record<string, Awaited<ReturnType<typeof measureNav>>> = {}
  for (const [index, { role, labels }] of NAV_AT_1366.entries()) {
    // Đổi vai trò: bỏ phiên (và ngôn ngữ) của tab rồi đăng nhập lại — màn đăng nhập về tiếng Việt
    if (index > 0) await page.evaluate(() => sessionStorage.clear())
    await login('/doi-xe', role)
    for (const lang of ['vi', 'en'] as const) {
      if (lang === 'en') await page.goto('/doi-xe?lang=en')
      const nav = page.getByRole('navigation', { name: lang === 'vi' ? 'Điều hướng chính' : 'Main navigation' })
      const fleet = lang === 'vi' ? 'Đội xe' : 'Fleet'
      await expect(nav.getByRole('link', { name: fleet, exact: true })).toHaveAttribute('aria-current', 'page')
      await page.mouse.move(683, 500)
      const measure = await measureNav(page)
      measures[`${role}-${lang}`] = measure
      const name = `${role} · ${lang}`
      expect.soft(measure.labels, name).toStrictEqual(labels[lang])
      expect.soft(measure.cutLabels, `${name}: cut labels`).toStrictEqual([])
      expect.soft(measure.navOverflow, `${name}: nav tray scrolls sideways`).toBeLessThanOrEqual(0)
      expect.soft(measure.gapToActions, `${name}: gap between the tray and the actions`).toBeGreaterThanOrEqual(20)
      expect.soft(measure.actionsRight, `${name}: actions end inside the viewport`).toBeLessThanOrEqual(1366)
      expect.soft(measure.pageOverflow, `${name}: page scrolls sideways`).toBeLessThanOrEqual(0)

      // Chỉ báo kính: ở mục đang mở, bám mục đang rê, về mục đang mở khi con trỏ rời thanh
      await expect.poll(() => glassOn(page), { message: `${name}: indicator on the open item` }).toBe(fleet)
      const [first] = labels[lang]
      await nav.getByRole('link', { name: first, exact: true }).hover()
      await expect.poll(() => glassOn(page), { message: `${name}: indicator follows the pointer` }).toBe(first)
      await page.mouse.move(683, 500)
      await expect.poll(() => glassOn(page), { message: `${name}: indicator returns to the open item` }).toBe(fleet)
    }
  }
  await attachJson(testInfo, 'nav-1366', measures)
  expect(browserErrors).toStrictEqual([])
})
