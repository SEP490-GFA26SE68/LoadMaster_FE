// Bộ ảnh bàn giao (LM-072, cập nhật đợt 6 — LM-101), chạy tay — không nằm trong `pnpm test:e2e` hay CI.
// Cần dev server chạy riêng: `pnpm dev --host 127.0.0.1 --port 5175 --strictPort`, rồi `node tests/handoff-screenshots.mjs`.
// Ảnh ghi vào `docs/screenshots/handoff/<vi|en>-<màn>.png`. Mỗi ảnh đăng nhập đúng vai trò của màn (phân quyền D-41).
// Kho dữ liệu nằm trong bộ nhớ trang: sau khi sửa dữ liệu chỉ đổi route phía client.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const origin = process.env.VIEWER_TEST_URL ?? 'http://127.0.0.1:5175'
const output = 'docs/screenshots/handoff'
const TRIP = 'TRIP-2026-0914'
const MOCK_DB = '/src/lib/mock-db/index.ts'
const EMAIL = {
  dispatcher: 'dieuphoi@loadmaster.vn',
  manager: 'quanly@loadmaster.vn',
  warehouse: 'kho@loadmaster.vn',
  driver: 'taixe@loadmaster.vn',
  systemAdmin: 'quantri@loadmaster.vn',
}
/** Giờ trang cố định 16:00 hôm nay (giờ Việt Nam): ảnh chụp lúc nào cũng thấy một ngày làm việc bình thường — seed không phải lùi
 * mốc giờ (`seed-shift.ts`) như khi mở app lúc sáng sớm. */
const VN_TODAY = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const PAGE_TIME = new Date(`${VN_TODAY}T16:00:00+07:00`)
const DESKTOP = { width: 1600, height: 1000 }
const TABLET = { width: 1024, height: 768 }
const PHONE = { width: 390, height: 844 }
await mkdir(output, { recursive: true })

const LOCALE = { vi: 'vi-VN', en: 'en-US' }
/** Một trình duyệt mỗi ngôn ngữ: ô ngày gốc lấy định dạng (dd/mm/yyyy ở ảnh tiếng Việt) theo `--lang` của trình duyệt — tuỳ chọn
 * `locale` của context không đổi được. */
let browser
const errors = []

async function session(lang, viewport, route, role = 'dispatcher') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: LOCALE[lang], timezoneId: 'Asia/Ho_Chi_Minh' })
  const page = await context.newPage()
  await page.clock.setFixedTime(PAGE_TIME)
  page.on('pageerror', (error) => errors.push(`${lang} ${route}: ${error.message}`))
  await page.goto(`${origin}${route}${route.includes('?') ? '&' : '?'}lang=${lang}`)
  await page.locator('input[type="email"]').fill(EMAIL[role])
  await page.locator('input[type="password"]').fill('loadmaster')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => url.pathname !== '/dang-nhap')
  return { page, close: () => context.close() }
}

const inApp = (page, route) => page.evaluate((to) => { history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate')) }, route)
const settle = (page, ms = 1500) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(ms))
async function shot(page, lang, name) {
  // Chuột ra góc trên phải (vùng tiêu đề trống): ảnh không dính hover dòng hay tooltip biểu đồ từ lần bấm trước
  await page.mouse.move(page.viewportSize().width - 1, 0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${output}/${lang}-${name}.png` })
  console.log(`${lang}-${name}`)
}
const label = (lang, vi, en) => (lang === 'vi' ? vi : en)

async function optimize(page) {
  await page.getByRole('button', { name: /^(Tối ưu|Optimize)$/ }).click()
  await page.waitForURL(/\/phuong-an\?revision=MOCK-/, { timeout: 60_000 })
  await page.locator('canvas').waitFor()
}

/** Màn chỉ cần mở route: [tên ảnh, vai trò, khung nhìn, route]. */
const PLAIN = [
  ['dashboard', 'manager', DESKTOP, '/'],
  ['trips', 'dispatcher', DESKTOP, '/chuyen'],
  ['trip-packages', 'dispatcher', DESKTOP, `/chuyen/${TRIP}`],
  ['trip-delivering', 'dispatcher', DESKTOP, '/chuyen/TRIP-009'],
  ['optimization-setup', 'dispatcher', DESKTOP, '/chuyen/TRIP-012/toi-uu'],
  ['planner-success', 'dispatcher', DESKTOP, `/chuyen/${TRIP}/phuong-an`],
  ['compare', 'dispatcher', DESKTOP, `/chuyen/${TRIP}/so-sanh`],
  ['fleet', 'dispatcher', DESKTOP, '/doi-xe'],
  ['vehicle-detail', 'dispatcher', DESKTOP, '/doi-xe/VEHICLE-002'],
  ['vehicle-maintenance', 'dispatcher', DESKTOP, '/doi-xe/VEHICLE-008'],
  ['audit-log', 'systemAdmin', DESKTOP, '/nhat-ky'],
  ['users', 'systemAdmin', DESKTOP, '/nguoi-dung'],
  ['profile', 'dispatcher', DESKTOP, '/ho-so'],
  ['forbidden', 'driver', DESKTOP, '/nguoi-dung'],
  ['warehouse-trips', 'warehouse', TABLET, '/kho'],
  ['warehouse-tablet', 'warehouse', TABLET, '/kho?chuyen=TRIP-011'],
  ['driver-trips', 'driver', PHONE, '/tai-xe'],
  ['driver-phone', 'driver', PHONE, '/tai-xe/diem-giao?chuyen=TRIP-010'],
]

for (const lang of ['vi', 'en']) {
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--lang=${LOCALE[lang]}`] })
  for (const [name, role, viewport, route] of PLAIN) {
    const { page, close } = await session(lang, viewport, route, role)
    if (name.startsWith('planner')) await page.locator('canvas').waitFor()
    await settle(page, name.startsWith('planner') || name.startsWith('warehouse-tablet') ? 2500 : 1200)
    await shot(page, lang, name)
    await close()
  }

  // Ma trận quyền (quản trị), chuông thông báo và tìm nhanh (điều phối), hộp nhập kiện (chuyến đang lập kế hoạch)
  {
    const { page, close } = await session(lang, DESKTOP, '/nguoi-dung', 'systemAdmin')
    await page.getByRole('tab', { name: label(lang, 'Ma trận quyền', 'Permission matrix') }).click()
    await settle(page, 800)
    await shot(page, lang, 'permission-matrix')
    await close()
  }
  {
    const { page, close } = await session(lang, DESKTOP, '/chuyen', 'dispatcher')
    await page.getByRole('button', { name: new RegExp(`^${label(lang, 'Thông báo', 'Notifications')}`) }).click()
    await settle(page, 800)
    await shot(page, lang, 'notifications')
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox').fill('bien hoa')
    await settle(page, 800)
    await shot(page, lang, 'quick-search')
    await close()
  }
  {
    const { page, close } = await session(lang, DESKTOP, '/chuyen/TRIP-012', 'dispatcher')
    await page.getByRole('button', { name: label(lang, 'Nhập từ file', 'Import from file') }).click()
    await settle(page, 800)
    await shot(page, lang, 'package-import')
    await close()
  }

  // Kết quả một phần: thêm 60 kiện không bắt buộc cho chuyến rồi chạy tối ưu thật.
  {
    const { page, close } = await session(lang, DESKTOP, '/doi-xe')
    await page.evaluate(async ({ url, tripId }) => {
      const db = (await import(url)).getMockDb()
      const trip = await db.getTrip(tripId)
      const bulky = { ...trip.packages[0], id: 'PKG-950', name: 'Extra cartons', quantity: 60, mustLoad: false, priority: 0 }
      await db.updateTrip(tripId, { packages: [...trip.packages, bulky] })
    }, { url: MOCK_DB, tripId: TRIP })
    await inApp(page, `/chuyen/${TRIP}/toi-uu`)
    await optimize(page)
    await settle(page, 2500)
    await shot(page, lang, 'planner-partial')
    await close()
  }

  // Lỗi thời: sửa khối lượng một kiện sau khi đã tối ưu.
  {
    const { page, close } = await session(lang, DESKTOP, '/doi-xe')
    await page.evaluate(async ({ url, tripId }) => {
      const db = (await import(url)).getMockDb()
      const trip = await db.getTrip(tripId)
      await db.updateTrip(tripId, { packages: trip.packages.map((pkg, i) => (i === 0 ? { ...pkg, weightKg: pkg.weightKg + 1 } : pkg)) })
    }, { url: MOCK_DB, tripId: TRIP })
    await inApp(page, `/chuyen/${TRIP}/phuong-an`)
    await page.getByRole('alert').first().waitFor()
    await page.locator('canvas').waitFor()
    await settle(page, 2500)
    await shot(page, lang, 'planner-stale')
    await close()
  }
  await browser.close()
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
