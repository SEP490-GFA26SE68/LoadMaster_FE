import type { Page } from '@playwright/test'
import { DEMO_EMAILS, DEMO_PASSWORD, expect, test } from './fixtures'
import { MOCK_DB, SEED_TRIP } from './spec-flow-helpers'

/**
 * Chuông thông báo (LM-098, D-55): nhân viên kho báo thiếu một kiện; điều phối viên đăng nhập trong cùng trang (kho in-memory) thấy
 * thông báo mới ở đầu danh sách, bấm vào mở chi tiết chuyến. Không `page.goto` sau khi ghi: tải lại là mất kho.
 */

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
}

test('a package the warehouse reports missing reaches the dispatcher bell and opens the trip', async ({ page, login, browserErrors }) => {
  await login('/kho', 'warehouse')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến cần xếp', exact: true })).toBeVisible()
  // Chuông ở màn kho chỉ báo xác nhận tay của mình bị từ chối (FE-6-04): chưa có gì
  await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toBeVisible()
  await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    await store.startLoading(tripId)
    const plan = (await store.listRevisions(tripId)).findLast((item) => item.approvedAt !== undefined)
    const [first] = plan?.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder) ?? []
    await store.recordLoadingStep(tripId, { packageInstanceId: first?.packageInstanceId ?? '', outcome: 'missing' })
  }, { db: MOCK_DB, tripId: SEED_TRIP })

  // Đăng xuất bằng nút tài khoản của màn kho (LM-096)
  await page.getByRole('button', { name: 'Tài khoản Lê Văn Hải', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click()
  await page.waitForURL(/\/dang-nhap$/)
  await signIn(page, DEMO_EMAILS.dispatcher, DEMO_PASSWORD)
  await page.waitForURL((url) => url.pathname === '/chuyen')

  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  const menu = page.getByRole('menu')
  const missing = menu.getByRole('menuitem').filter({ hasText: 'Báo thiếu kiện ở kho' })
  await expect(missing).toHaveCount(1)
  await expect(missing).toContainText(SEED_TRIP)
  await expect(missing).toContainText('Chưa đọc')
  // Mới nhất trước: ngay dưới mục "Đánh dấu đã đọc"
  await expect(menu.getByRole('menuitem').nth(1)).toContainText('Báo thiếu kiện ở kho')

  await missing.click()
  await page.waitForURL(new RegExp(`/chuyen/${SEED_TRIP}$`))
  await expect(page.getByRole('heading', { name: 'Kiện hàng', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
