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
      await expect(page.locator('canvas:not(.maplibregl-canvas)')).toBeVisible()
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
    // FE-5b-05: danh sách ba phương án, nhóm kiểm tra Tuyến và bảng lần chạy có ba dòng phương án mỗi lần chạy
    name: 'optimization-setup',
    route: '/chuyen/TRIP-2026-0914/toi-uu',
    ready: async (page) => {
      await expect(page.getByRole('list', { name: 'Ba phương án mỗi lần chạy', exact: true })).toBeVisible()
      await expect(page.locator('[data-run-history]').getByRole('row')).toHaveCount(3)
    },
  },
  {
    // FE-5b-06: ba thẻ phương án cạnh nhau — số đo và tên điểm giao xuống dòng, không cắt
    name: 'plan-candidates',
    route: '/chuyen/TRIP-2026-0914/so-sanh?lan-chay=RUN-002',
    ready: async (page) => {
      await expect(page.locator('[data-candidate]')).toHaveCount(3)
      await expect(page.locator('[data-stop-deadline]')).toHaveCount(4)
      await expect(page.locator('header:has(h1)')).toContainText('Lần chạy RUN-002 · 3 phương án ứng viên')
    },
  },
  {
    name: 'planner',
    route: PLANNER_ROUTE,
    ready: async (page) => {
      await expect(page.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toBeVisible()
      await expect(page.locator('canvas:not(.maplibregl-canvas)')).toBeVisible()
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
    // FE-6-10: bản đồ, danh sách và chi tiết của chuyến seed đang vận chuyển
    name: 'monitoring',
    route: '/giam-sat',
    ready: async (page) => {
      await expect(page.getByRole('region', { name: 'Giám sát chuyến TRIP-009', exact: true }).getByText(/^[\d.]+ điểm vị trí$/)).toBeVisible()
      await expect(page.getByRole('region', { name: 'Bản đồ các xe đang vận chuyển', exact: true }).locator('.maplibregl-marker')).not.toHaveCount(0)
    },
  },
  {
    name: 'dashboard',
    route: '/tong-quan',
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
  { name: 'dashboard', role: 'dispatcher', route: '/tong-quan', ready: async (page) => { await expect(page.getByRole('group', { name: 'Chuyến hoàn thành', exact: true })).toBeVisible() } },
  { name: 'trip-detail', role: 'dispatcher', route: '/chuyen/TRIP-2026-0914', ready: async (page) => { await expect(page.getByRole('heading', { name: 'Kiện hàng', exact: true })).toBeVisible() } },
  { name: 'vehicle-detail', role: 'dispatcher', route: '/doi-xe/VEHICLE-002', ready: async (page) => { await expect(page.getByRole('heading', { name: 'Vật cản trong thùng', exact: true })).toBeVisible() } },
  // FE-5b-06: màn so sánh ba phương án dài hơn một màn hình. Chờ cả dòng dữ liệu của dải trời: nó về sau các thẻ và làm vùng cuộn thấp đi
  {
    name: 'plan-candidates', role: 'dispatcher', route: '/chuyen/TRIP-2026-0914/so-sanh?lan-chay=RUN-002',
    ready: async (page) => {
      await expect(page.locator('[data-candidate]')).toHaveCount(3)
      await expect(page.locator('header:has(h1)')).toContainText('Lần chạy RUN-002 · 3 phương án ứng viên')
    },
  },
  { name: 'fleet', role: 'dispatcher', route: '/doi-xe', ready: async (page) => { await expect(page.getByRole('row', { name: /VEHICLE-008/ })).toBeVisible() } },
  // FE-6-10: màn Giám sát dài hơn một màn hình; bánh xe chuột lăn qua bản đồ vẫn cuộn màn. Chờ bản đồ dựng xong: lăn chuột đúng lúc
  // sơ đồ chờ bị thay bằng bản đồ thì trình duyệt bỏ dở lần cuộn (phần tử dưới con trỏ vừa bị gỡ)
  {
    name: 'monitoring', role: 'dispatcher', route: '/giam-sat',
    ready: async (page) => {
      await expect(page.getByRole('region', { name: 'Giám sát chuyến TRIP-009', exact: true }).getByText(/^[\d.]+ điểm vị trí$/)).toBeVisible()
      await expect(page.getByRole('region', { name: 'Bản đồ các xe đang vận chuyển', exact: true }).locator('.maplibregl-marker')).not.toHaveCount(0)
    },
  },
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
    // Một lần lăn có thể bị trình duyệt bỏ dở khi phần tử dưới con trỏ vừa được dựng lại (bản đồ, ảnh tải lười trên máy CI chậm): chưa tới
    // đáy thì lăn tiếp như người dùng — màn không cuộn được bằng bánh xe thì lăn bao nhiêu lần cũng không tới đáy, test vẫn đỏ
    await expect.poll(async () => {
      if (await bottomOfLastChild()) return true
      await page.mouse.wheel(0, 5000)
      return bottomOfLastChild()
    }, { message: `${screen.name}: wheel reaches the end` }).toBe(true)
    const pageScroll = await page.evaluate(() => ({ tall: document.documentElement.scrollHeight > innerHeight, y: scrollY, navTop: document.querySelector('header')!.getBoundingClientRect().top }))
    expect.soft(pageScroll, screen.name).toStrictEqual({ tall: false, y: 0, navTop: 0 })
  }
})


/**
 * FE-0-04: thanh điều hướng theo vai trò — hai vai trò nhiều mục nhất (điều phối viên và quản lý công ty), cả hai ngôn ngữ, từ mốc
 * mục còn chữ (1.340 px) tới 1.920 px. Mẫu "priority+" (`NavTray`): mục không vừa dồn vào nút "Thêm" cuối khay, nên khay không bao giờ
 * cuộn ngang; mục hiện trên khay cộng mục trong menu "Thêm" là đúng danh sách của vai trò, theo thứ tự. Không mục nào bị cắt chữ hay
 * chồng lên mục bên cạnh, khay không chạm cụm nút bên phải, trang không cuộn ngang; chỉ báo kính bám mục đang rê và về mục đang mở
 * (hoặc nút "Thêm" khi mục đang mở nằm trong đó) khi con trỏ rời thanh. Số đo đính kèm báo cáo (`nav-widths`).
 */
const NAV_ROLES: readonly { role: Role; labels: Readonly<Record<'vi' | 'en', readonly string[]>> }[] = [
  {
    role: 'dispatcher',
    labels: { vi: ['Chuyến hàng', 'Giám sát', 'Kho kiện', 'Yêu cầu giao', 'Đội xe', 'Bảng điều khiển', 'Phiếu lương'], en: ['Trips', 'Monitoring', 'Package pool', 'Requirements', 'Fleet', 'Dashboard', 'Payslip'] },
  },
  {
    role: 'companyManager',
    labels: { vi: ['Bảng điều khiển', 'Yêu cầu giao', 'Kho kiện', 'Chuyến hàng', 'Giám sát', 'Đội xe', 'Kho bãi', 'Bảng lương'], en: ['Dashboard', 'Requirements', 'Package pool', 'Trips', 'Monitoring', 'Fleet', 'Warehouses', 'Payroll'] },
  },
]
const NAV_WIDTHS = [1340, 1366, 1600, 1920] as const
/** Khay chật nhất có chữ: thanh của khách ở 1.340 px chỉ còn đúng chỗ cho phần lớn các mục. Dùng để buộc có nút "Thêm". */
const NARROW_SLOT = 640

function measureNav(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('header')!
    const nav = header.querySelector('nav')!
    const items = [...nav.querySelectorAll<HTMLElement>('a, button')]
    const rects = items.map((item) => item.getBoundingClientRect())
    const actions = header.lastElementChild!.getBoundingClientRect()
    const navRect = nav.getBoundingClientRect()
    return {
      labels: items.filter((item) => item.tagName === 'A').map((item) => item.innerText.trim()),
      more: items.find((item) => item.tagName === 'BUTTON')?.innerText.trim() ?? null,
      cutLabels: items.filter((item) => item.scrollWidth > item.clientWidth + 1).map((item) => item.innerText.trim()),
      overlaps: rects.slice(1).filter((rect, index) => rect.left < rects[index]!.right - 0.5).length,
      outsideTray: rects.filter((rect) => rect.left < navRect.left || rect.right > navRect.right + 0.5).length,
      navWidth: Math.round(navRect.width),
      navOverflow: nav.scrollWidth - nav.clientWidth,
      gapToActions: Math.round(actions.left - navRect.right),
      actionsRight: Math.round(actions.right),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

/** Chỉ báo kính đang nằm trên mục nào (theo `left` / `width` hook đặt): tên của mục, `more` cho nút "Thêm", `null` khi đang giấu. */
function glassOn(page: Page) {
  return page.evaluate(() => {
    const nav = document.querySelector('header nav')!
    const follow = nav.querySelector<HTMLElement>('.glass-follow')!
    if (follow.hidden) return null
    const item = [...nav.querySelectorAll<HTMLElement>('a, button')]
      .find((element) => `${element.offsetLeft}px` === follow.style.left && `${element.offsetWidth}px` === follow.style.width)
    if (!item) return 'no item'
    return item.tagName === 'BUTTON' ? 'more' : item.getAttribute('aria-label')
  })
}

/** Mục trong menu "Thêm" đang mở (mở rồi đóng lại bằng Esc, focus về nút). */
async function moreMenuLabels(page: Page) {
  const more = page.locator('header nav button')
  await more.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const labels = (await menu.getByRole('menuitem').allInnerTexts()).map((label) => label.trim())
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(more).toBeFocused()
  return labels
}

test('the nav bar of the roles with the most items never scrolls: items that do not fit move into the More menu (FE-0-04)', async ({ page, login, browserErrors }, testInfo) => {
  test.setTimeout(180_000)
  const measures: Record<string, Awaited<ReturnType<typeof measureNav>> & { menu: readonly string[] }> = {}
  for (const [index, { role, labels }] of NAV_ROLES.entries()) {
    // Đổi vai trò: bỏ phiên (và ngôn ngữ) của tab rồi đăng nhập lại — màn đăng nhập về tiếng Việt
    if (index > 0) await page.evaluate(() => sessionStorage.clear())
    await page.setViewportSize({ width: 1366, height: 768 })
    await login('/doi-xe', role)
    for (const lang of ['vi', 'en'] as const) {
      await page.goto(`/doi-xe?lang=${lang}`)
      const fleet = lang === 'vi' ? 'Đội xe' : 'Fleet'
      for (const width of NAV_WIDTHS) {
        await page.setViewportSize({ width, height: 768 })
        const name = `${role} · ${lang} · ${width}`
        await page.mouse.move(width / 2, 500)
        await expect(page.getByRole('navigation', { name: lang === 'vi' ? 'Điều hướng chính' : 'Main navigation' })).toBeVisible()
        // Chờ khay đo xong cho bề rộng mới: mục hiện + mục trong "Thêm" luôn đủ danh sách
        await expect.poll(async () => (await measureNav(page)).labels.length > 0).toBe(true)
        const measure = await measureNav(page)
        const menu = measure.more === null ? [] : await moreMenuLabels(page)
        measures[name] = { ...measure, menu }
        expect.soft([...measure.labels, ...menu], `${name}: shown + More = every item, in order`).toStrictEqual(labels[lang])
        expect.soft(measure.cutLabels, `${name}: cut labels`).toStrictEqual([])
        expect.soft(measure.overlaps, `${name}: overlapping items`).toBe(0)
        expect.soft(measure.outsideTray, `${name}: items outside the tray`).toBe(0)
        expect.soft(measure.navOverflow, `${name}: nav tray scrolls sideways`).toBeLessThanOrEqual(0)
        expect.soft(measure.gapToActions, `${name}: gap between the tray and the actions`).toBeGreaterThanOrEqual(20)
        expect.soft(measure.actionsRight, `${name}: actions end inside the viewport`).toBeLessThanOrEqual(width)
        expect.soft(measure.pageOverflow, `${name}: page scrolls sideways`).toBeLessThanOrEqual(0)
        // "Thêm" chứa mục đang mở thì nút mang tên mục đó
        if (menu.includes(fleet)) expect.soft(measure.more, `${name}: More shows the open item`).toBe(fleet)

        // Chỉ báo kính: ở mục đang mở (hay nút "Thêm" đang chứa nó), bám mục đang rê, về chỗ cũ khi con trỏ rời thanh
        const home = measure.labels.includes(fleet) ? fleet : 'more'
        await page.mouse.move(width / 2, 500)
        await expect.poll(() => glassOn(page), { message: `${name}: indicator on the open item` }).toBe(home)
        const [first] = labels[lang]
        await page.locator('header nav a').first().hover()
        await expect.poll(() => glassOn(page), { message: `${name}: indicator follows the pointer` }).toBe(first)
        await page.mouse.move(width / 2, 500)
        await expect.poll(() => glassOn(page), { message: `${name}: indicator returns to the open item` }).toBe(home)

        if (role === 'dispatcher' && (width === 1366 || width === 1600)) {
          await attachScreenshot(page, testInfo, `nav-${role}-${lang}-${width}`, { clip: { x: 0, y: 0, width, height: 60 } })
        }
      }
    }
  }
  await attachJson(testInfo, 'nav-widths', measures)
  expect(browserErrors).toStrictEqual([])
})

/**
 * Khay chật (giả bằng cách thu khung của khay, như khi máy chủ thêm mục hay nút trợ lý): có nút "Thêm", bàn phím mở được menu, chọn một
 * mục trong menu điều hướng tới đúng màn; mục đang mở nằm trong "Thêm" thì nút mang tên mục đó và chỉ báo kính nghỉ ở nút.
 */
test('a tight nav tray keeps every item reachable through the More menu (FE-0-04)', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await login('/chuyen', 'dispatcher')
  const narrow = () => page.addStyleTag({ content: `[data-nav-slot] { flex: none !important; width: ${NARROW_SLOT}px !important; }` })
  await narrow()
  const more = page.locator('header nav button')
  await expect(more).toHaveAccessibleName(/^Thêm \d+ mục$/)
  const shown = (await page.locator('header nav a').allInnerTexts()).map((label) => label.trim())
  expect(shown[0]).toBe('Chuyến hàng')

  // Bàn phím: Tab tới nút, Enter mở, mũi tên đi trong menu
  await more.focus()
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const hidden = (await menu.getByRole('menuitem').allInnerTexts()).map((label) => label.trim())
  expect([...shown, ...hidden]).toStrictEqual(NAV_ROLES[0]!.labels.vi)
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()
  await attachScreenshot(page, testInfo, 'nav-more-open', { clip: { x: 0, y: 0, width: 1366, height: 360 } })

  // Chọn mục cuối của menu: tới đúng màn, nút mang tên mục đó, chỉ báo kính nghỉ ở nút
  const last = hidden.at(-1)!
  await menu.getByRole('menuitem', { name: last, exact: true }).click()
  await expect(page).toHaveURL(/\/phieu-luong$/)
  await expect(more).toHaveText(last)
  await expect(more).toHaveAccessibleName(new RegExp(`đang mở: ${last}$`))
  await page.mouse.move(683, 500)
  await expect.poll(() => glassOn(page)).toBe('more')
  await more.click()
  await expect(menu.getByRole('menuitem', { name: last, exact: true })).toHaveAttribute('aria-current', 'page')
  await attachScreenshot(page, testInfo, 'nav-more-current', { clip: { x: 0, y: 0, width: 1366, height: 360 } })
  await page.keyboard.press('Escape')
  expect(browserErrors).toStrictEqual([])
})
