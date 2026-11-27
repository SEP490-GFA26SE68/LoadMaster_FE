import type { Page } from '@playwright/test'
import { attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import { navigateInApp } from './spec-flow-helpers'

/**
 * Thẻ xe ở hàng góc dưới phải khung 3D của Planner (thay nút "Đổi xe", FE-5b-08): ở 768 → 1.536 px, tiếng Việt và tiếng Anh, có và
 * không có kiện ghim ("Chạy lại giữ ghim" cùng hàng), các điều khiển của hàng không chồng nhau, nằm gọn trong khung 3D, không đè thanh
 * kiện gọn bên trái hay cột nổi bên phải (thẻ kiện đang chọn). Bảng thông số xe mở và đóng bằng bàn phím, con trỏ về thẻ.
 */
test.use({ collectConsoleErrors: true })

const MOCK_DB = '/src/lib/mock-db/index.ts'
const TRIP_ID = 'TRIP-2026-0914'
const WIDTHS = [768, 1024, 1280, 1366, 1536] as const
const card = (page: Page) => page.getByRole('button', { name: /^(Xe của chuyến|Trip vehicle): / })

type Box = { x: number; y: number; width: number; height: number; label: string }

/** Hộp của từng điều khiển trong hàng góc, của khung 3D, thanh kiện gọn và các thẻ trong cột nổi bên phải (chỉ phần đang hiện). */
function cornerLayout(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const box = (el: Element, label: string) => {
      const { x, y, width, height } = el.getBoundingClientRect()
      return { x, y, width, height, label }
    }
    const hud = document.querySelector('[data-scene-hud]')!
    const corner = hud.querySelector('[data-hud-corner]')!
    // Con của hàng; nhóm "kiện đã ghim" (div bọc) tính từng phần tử của nó: câu lý do, nhãn, nút
    const controls = [...corner.children].flatMap((el) => (el.tagName === 'DIV' ? [...el.children] : [el]))
      .filter((el) => visible(el) && !el.classList.contains('sr-only'))
      .map((el) => box(el, (el.getAttribute('aria-label') ?? el.textContent ?? '').slice(0, 40)))
    const bar = hud.querySelector('[data-hud-package-bar]')
    const inspector = [...document.querySelectorAll('[data-scene-inspector] > *')].filter(visible).map((el) => box(el, 'inspector'))
    return {
      frame: box(hud, 'frame'), controls,
      others: [...(bar && visible(bar) ? [box(bar, 'package bar')] : []), ...inspector],
      scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
    }
  })
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5

async function expectCornerFits(page: Page, width: number, tag: string) {
  await page.setViewportSize({ width, height: width < 1280 ? 1000 : 800 })
  await expect(card(page)).toBeVisible()
  const { frame, controls, others, scrollWidth, innerWidth } = await cornerLayout(page)
  const where = `${tag} @ ${width} px`
  expect(controls.length, where).toBeGreaterThanOrEqual(2)
  expect(scrollWidth, `${where}: page scrolls sideways`).toBeLessThanOrEqual(innerWidth)
  for (const control of controls) {
    expect(control.x >= frame.x - 0.5 && control.x + control.width <= frame.x + frame.width + 0.5
      && control.y >= frame.y - 0.5 && control.y + control.height <= frame.y + frame.height + 0.5, `${where}: ${control.label} outside the 3D frame`).toBe(true)
    for (const other of [...controls, ...others]) {
      if (other !== control) expect(overlaps(control, other), `${where}: ${control.label} overlaps ${other.label}`).toBe(false)
    }
  }
}

/** Lưu một kiện ghim cùng bản duyệt mới (như "Duyệt bản chỉnh" sau khi ghim) rồi mở Planner ở bản đó. */
async function openPinnedPlan(page: Page, query = '') {
  const revisionId = await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const approved = (await db.listRevisions(tripId)).filter((revision) => revision.approvedAt !== undefined).at(-1)!
    return (await db.approveRevision(approved.id, [], { pinned: ['PKG-001-01'] })).id
  }, { url: MOCK_DB, tripId: TRIP_ID })
  await navigateInApp(page, `/chuyen/${TRIP_ID}/phuong-an?revision=${revisionId}${query}`)
  await expect(page.getByText(/^(1 kiện đã ghim|1 pinned package)$/)).toBeVisible()
}

test('the vehicle card fits the bottom-right row next to the pin rerun and details at every width, in both languages', async ({ page, login, browserErrors }, testInfo) => {
  test.setTimeout(3 * 60_000)
  await login(PLANNER_ROUTE, 'dispatcher')
  await page.locator('canvas:not(.maplibregl-canvas)').waitFor()
  for (const width of WIDTHS) await expectCornerFits(page, width, 'vi')
  await openPinnedPlan(page)
  for (const width of WIDTHS) await expectCornerFits(page, width, 'vi pinned')
  await page.setViewportSize({ width: 1440, height: 900 })
  await attachScreenshot(page, testInfo, 'planner-vehicle-card-1440')

  // `?lang=en` đọc lúc tải trang: kho về seed, phiên đăng nhập nằm trong sessionStorage
  await page.goto(`${PLANNER_ROUTE}?lang=en`)
  await page.locator('canvas:not(.maplibregl-canvas)').waitFor()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  for (const width of WIDTHS) await expectCornerFits(page, width, 'en')
  await openPinnedPlan(page)
  for (const width of WIDTHS) await expectCornerFits(page, width, 'en pinned')
  expect(browserErrors).toStrictEqual([])
})

test('the vehicle details open and close from the keyboard; the dispatcher reaches "Đổi xe" from there', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(PLANNER_ROUTE, 'dispatcher')
  await page.locator('canvas:not(.maplibregl-canvas)').waitFor()
  const trigger = card(page)
  await expect(trigger).toContainText('Hyundai HD210')
  await expect(trigger).toContainText(/\d+ × \d+ × \d+ cm · [\d.]+ kg/)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.focus()
  await page.keyboard.press('Enter')
  const panel = page.getByRole('dialog', { name: 'Xe của chuyến', exact: true })
  await expect(panel).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  for (const label of ['Lòng thùng', 'Cửa sau', 'Tải trọng tối đa', 'Trục', 'Giới hạn trục trước', 'Giới hạn trục sau', 'Vật cản']) {
    await expect(panel.getByRole('term').filter({ hasText: new RegExp(`^${label}$`) }), label).toBeVisible()
  }
  const box = (await panel.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(1440)
  await attachScreenshot(page, testInfo, 'planner-vehicle-panel-1440')
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(trigger).toBeFocused()

  // "Đổi xe" ở chân bảng: bảng đóng, hộp Đổi xe mở; Esc đóng hộp đó và con trỏ về thẻ
  await page.keyboard.press('Enter')
  await panel.getByRole('button', { name: 'Đổi xe', exact: true }).click()
  const change = page.getByRole('dialog', { name: `Đổi xe của chuyến ${TRIP_ID}` })
  await expect(change).toBeVisible()
  await expect(panel).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(change).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(browserErrors).toStrictEqual([])
})
