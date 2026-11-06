import type { Page } from '@playwright/test'
import { DEMO_EMAILS, DEMO_PASSWORD, expect, test } from './fixtures'
import { MOCK_DB, SEED_TRIP } from './spec-flow-helpers'

/**
 * Chuông thông báo (LM-098, D-55; FE-6-02): nhân viên kho báo thiếu một kiện lúc soạn hàng; điều phối viên đăng nhập trong cùng trang (kho in-memory) thấy
 * thông báo mới ở đầu danh sách, bấm vào mở chi tiết chuyến. Tài xế (FE-6-01): kho bắt đầu soạn hàng chuyến của mình là thông báo "chuyến mới" ở chuông
 * của màn "Chuyến của tôi", bấm vào mở màn điểm giao. Không `page.goto` sau khi ghi: tải lại là mất kho.
 */

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
}

test('a package the warehouse reports missing reaches the dispatcher bell and opens the trip', async ({ page, login, browserErrors }) => {
  await login('/kho', 'warehouse')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến cần xếp', exact: true })).toBeVisible()
  // Chuông ở màn kho chỉ báo việc của chính mình bị quyết và chuyến bị huỷ lúc đang xếp (FE-6-04, FE-6-02, FE-6-07): chưa có gì
  await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toBeVisible()
  await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    await store.startLoading(tripId)
    const plan = (await store.listRevisions(tripId)).findLast((item) => item.approvedAt !== undefined)
    const [first] = plan?.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder) ?? []
    await store.reportStagingShortage(tripId, first?.packageInstanceId ?? '')
  }, { db: MOCK_DB, tripId: SEED_TRIP })

  // Đăng xuất bằng nút tài khoản của màn kho (LM-096)
  await page.getByRole('button', { name: 'Tài khoản Lê Văn Hải', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click()
  await page.waitForURL(/\/dang-nhap$/)
  await signIn(page, DEMO_EMAILS.dispatcher, DEMO_PASSWORD)
  await page.waitForURL((url) => url.pathname === '/chuyen')

  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  const menu = page.getByRole('menu')
  const missing = menu.getByRole('menuitem').filter({ hasText: 'Kho báo thiếu kiện khi soạn hàng' })
  await expect(missing).toHaveCount(1)
  await expect(missing).toContainText(SEED_TRIP)
  await expect(missing).toContainText('Chưa đọc')
  // Mới nhất trước: ngay dưới mục "Đánh dấu đã đọc"
  await expect(menu.getByRole('menuitem').nth(1)).toContainText('Kho báo thiếu kiện khi soạn hàng')

  await missing.click()
  await page.waitForURL(new RegExp(`/chuyen/${SEED_TRIP}$`))
  await expect(page.getByRole('heading', { name: 'Kiện hàng', exact: true })).toBeVisible()
  // Chi tiết chuyến: thẻ để điều phối viên quyết kiện thiếu, và dòng phụ của chuyến
  await expect(page.getByRole('region', { name: 'Kiện kho báo thiếu' })).toContainText('Lê Văn Hải báo lúc')
  await expect(page.locator('header').getByText('Thiếu kiện — chờ điều phối', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('phone: the warehouse starting to stage a trip reaches the bell of its driver as a new trip, and the notice opens it on the driver screen', { tag: '@phone' }, async ({ page, login, browserErrors }) => {
  await login('/tai-xe', 'driver')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến của tôi', exact: true })).toBeVisible()
  // Nhân viên kho Lê Văn Hải bắt đầu soạn hàng chuyến chính của tài xế demo, như đang thao tác ở máy tính bảng của kho
  await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    store.restoreSession('US-0003')
    try {
      await store.startLoading(tripId)
    } finally {
      store.restoreSession('US-0004')
    }
  }, { db: MOCK_DB, tripId: SEED_TRIP })

  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  const notice = page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Chuyến mới: kho đang soạn hàng' }).filter({ hasText: SEED_TRIP })
  await expect(notice).toHaveCount(1)
  await expect(notice).toContainText('Chưa đọc')
  await notice.click()
  await page.waitForURL((url) => url.pathname === '/tai-xe/diem-giao' && url.searchParams.get('chuyen') === SEED_TRIP)
  expect(browserErrors).toStrictEqual([])
})
