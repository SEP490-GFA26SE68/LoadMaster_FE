import { expect, test } from './fixtures'
import { heightOf, MOCK_DB, overflowingText } from './spec-flow-helpers'

/**
 * FE-6-13: tài xế demo bật "Dùng GPS thật" trên điện thoại khi chuyến `TRIP-010` Đang vận chuyển — trình duyệt cấp quyền vị trí và trả
 * toạ độ giả của Playwright; điểm vị trí nguồn GPS nằm trong kho của trang (D-95). Tắt thì vị trí về mô phỏng, có thông báo.
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-010'
const HERE = { latitude: 10.8712, longitude: 106.7813 }

test('phone: real GPS is off until the trip is in transit; turned on it sends the device position, turned off it goes back to simulation', { tag: '@phone' }, async ({ page, context, login, browserErrors }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation(HERE)
  await login(`/tai-xe/diem-giao?chuyen=${TRIP}`, 'driver')
  const toggle = page.getByRole('switch', { name: 'Dùng GPS thật', exact: true })
  // Kho đã xếp xong, xe chưa xuất phát: chưa có công tắc
  await expect(page.getByRole('button', { name: 'Xuất phát', exact: true })).toBeVisible()
  await expect(toggle).toHaveCount(0)
  await page.getByRole('button', { name: 'Xuất phát', exact: true }).tap()

  await expect(toggle).toBeVisible()
  await expect(toggle).not.toBeChecked()
  const section = page.getByRole('region', { name: 'Vị trí xe', exact: true })
  await expect(section).toContainText('Mô phỏng')
  await expect(section).toContainText('Chưa có máy chủ: vị trí từ điện thoại chỉ hiện trong trình duyệt này.')
  // Hàng công tắc là vùng chạm 56 px
  expect(await heightOf(section.getByText('Dùng GPS thật', { exact: true }))).toBeGreaterThanOrEqual(56)

  await toggle.tap()
  await expect(section.getByRole('status')).toHaveText(/^Đã gửi vị trí lúc \d\d:\d\d\. Gửi lại mỗi 30 giây\.$/, { timeout: 15_000 })
  await expect(toggle).toBeChecked()
  await expect(section.getByText('GPS', { exact: true })).toBeVisible()
  expect(await overflowingText(page)).toStrictEqual([])
  const point = await page.evaluate(async ({ db, trip }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const last = (await getMockDb().getLocationHistory(trip)).findLast((item) => item.source === 'GPS')
    return last ? { lat: last.lat, lng: last.lng } : null
  }, { db: MOCK_DB, trip: TRIP })
  expect(point).toStrictEqual({ lat: HERE.latitude, lng: HERE.longitude })

  await toggle.tap()
  await expect(toggle).not.toBeChecked()
  await expect(section.getByRole('status')).toHaveText('Đã tắt GPS thật: vị trí xe về mô phỏng.')
  await expect(section).toContainText('Mô phỏng')
  expect(browserErrors).toStrictEqual([])
})
