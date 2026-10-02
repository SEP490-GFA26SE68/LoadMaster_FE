import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { navigateInApp, signInWith, signOutInApp } from './spec-flow-helpers'

/**
 * Cách ly dữ liệu theo công ty (FE-0-02, D-64): kho lọc theo công ty của người đang đăng nhập, màn không tự lọc. Điều phối viên của
 * Phương Nam chỉ thấy chuyến và xe của Phương Nam, mở chuyến của Long Bình bằng URL thì như chuyến không tồn tại; điều phối viên của
 * Long Bình không thấy gì của Phương Nam. Hai người đổi nhau ngay trong app, không tải lại trang: cache Query của người trước cũng
 * không được hiện cho người sau.
 */

const tripRows = (page: Page) => page.getByRole('row').filter({ hasText: /TRIP-/ })
const vehicleRows = (page: Page) => page.getByRole('row').filter({ hasText: /VEHICLE-/ })

/** Mở một đường dẫn của công ty khác: chi tiết chuyến, Planner và chi tiết xe đều báo không tìm thấy, có lối về. */
async function expectNotFound(page: Page, tripId: string, vehicleId: string) {
  await navigateInApp(page, `/chuyen/${tripId}`)
  await expect(page.getByRole('heading', { name: `Không tìm thấy chuyến ${tripId}`, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Về danh sách chuyến', exact: true })).toBeVisible()
  await navigateInApp(page, `/chuyen/${tripId}/phuong-an`)
  await expect(page.getByText(`Không tìm thấy chuyến ${tripId}.`, { exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await navigateInApp(page, `/doi-xe/${vehicleId}`)
  await expect(page.getByText(`Không tìm thấy xe ${vehicleId}.`, { exact: true })).toBeVisible()
}

test('each dispatcher sees only the trips and vehicles of their company; a trip of the other company opened by URL is not found', async ({ page, browserErrors }) => {
  await page.goto('/')

  // Phương Nam: hai chuyến và hai xe của seed Phương Nam
  await signInWith(page, 'dieuphoi@phuongnam.vn')
  await page.waitForURL(/\/chuyen$/)
  await expect(tripRows(page)).toHaveCount(2)
  await expect(page.getByRole('row', { name: /TRIP-PN-001/ })).toContainText('Tuyến Quận 7 – Nhà Bè')
  await expect(page.getByRole('row', { name: /TRIP-PN-002/ })).toContainText('Tuyến Quận 4 – Quận 1')
  await expect(page.getByText(/TRIP-2026-0914|TRIP-0\d\d/)).toHaveCount(0)

  await navigateInApp(page, '/doi-xe')
  await expect(vehicleRows(page)).toHaveCount(2)
  await expect(page.getByRole('row', { name: /VEHICLE-PN-01/ })).toContainText('Isuzu QKR 230')
  await expect(page.getByRole('row', { name: /VEHICLE-PN-02/ })).toContainText('Hino XZU730')
  await expect(page.getByText(/Hyundai HD210|Truck 6m/)).toHaveCount(0)

  await expectNotFound(page, 'TRIP-2026-0914', 'VEHICLE-002')

  // Long Bình, đổi người ngay trong app: 15 chuyến và 8 xe của Long Bình, không dòng nào của Phương Nam
  await signOutInApp(page)
  await signInWith(page, 'dieuphoi@loadmaster.vn')
  await page.waitForURL(/\/chuyen$/)
  await expect(tripRows(page)).toHaveCount(15)
  await expect(page.getByRole('row', { name: /TRIP-2026-0914/ })).toContainText('Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên Hoà')
  await expect(page.getByText(/TRIP-PN-/)).toHaveCount(0)

  await navigateInApp(page, '/doi-xe')
  await expect(vehicleRows(page)).toHaveCount(8)
  await expect(page.getByText(/VEHICLE-PN-|Isuzu QKR 230|Hino XZU730/)).toHaveCount(0)

  await expectNotFound(page, 'TRIP-PN-001', 'VEHICLE-PN-01')
  expect(browserErrors).toStrictEqual([])
})
