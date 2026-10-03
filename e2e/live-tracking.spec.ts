import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { MOCK_DB, navigateInApp, overflowingText } from './spec-flow-helpers'

/**
 * FE-6-08, FE-6-09: vị trí xe mô phỏng và giờ đến tính từ vị trí ở Chi tiết chuyến của điều phối viên. Kho nằm trong bộ nhớ của tab
 * (D-95): việc của tài xế — xuất phát, dỡ hàng, hoàn tất điểm — ghi thẳng vào kho của trang, như tài xế vừa làm trên cùng tab.
 * Đồng hồ của kho tua nhanh bằng `?toc-do` lúc tải trang. Không chờ theo giờ cố định: mọi bước chờ tới một trạng thái của màn.
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-010'

/** Tâm của một mốc trên bản đồ, px. */
async function centerOf(marker: Locator) {
  const box = await marker.boundingBox()
  if (!box) throw new Error('marker is not on the map')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** Tài xế dỡ hết kiện của điểm `stop` rồi hoàn tất điểm. */
async function driverCompletesStop(page: Page, stop: number) {
  await page.evaluate(async ({ url, tripId, stopNumber }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const trip = await db.getTrip(tripId)
    const plan = await db.getRevision(trip.loading?.revisionId ?? '')
    const prefixes = plan.request.packages.filter((pkg) => pkg.deliveryStop === stopNumber).map((pkg) => `${pkg.id}-`)
    for (const { packageInstanceId } of plan.result.placements) {
      if (prefixes.some((prefix) => packageInstanceId.startsWith(prefix))) await db.recordUnload(tripId, stopNumber, packageInstanceId, true)
    }
    await db.completeStop(tripId, stopNumber)
  }, { url: MOCK_DB, tripId: TRIP, stopNumber: stop })
}

test('the simulated vehicle of a trip in transit moves on the trip detail, waits at each stop for the driver, and arrival times follow it', async ({ page, login, browserErrors }) => {
  test.slow()
  // Đồng hồ của kho nhanh 40 lần: chặng kho → điểm 1 (24 phút 51 giây) là khoảng 37 giây thật
  await login('/chuyen?toc-do=40')
  await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    await getMockDb().startDelivery(tripId)
  }, { url: MOCK_DB, tripId: TRIP })
  await navigateInApp(page, `/chuyen/${TRIP}`)

  // Vị trí luôn kèm nhãn "Mô phỏng"; giờ đến tính từ vị trí mang MOCK RESULT
  const bar = page.getByRole('status', { name: 'Vị trí xe', exact: true })
  await expect(bar).toBeVisible()
  await expect(bar.getByText('Mô phỏng', { exact: true })).toBeVisible()
  await expect(bar.getByText('MOCK RESULT', { exact: true })).toBeVisible()
  await expect(bar).toContainText('đang chạy 50 km/h')

  const stops = page.getByRole('list', { name: /^Kho xuất phát rồi/ }).getByRole('listitem')
  await expect(stops.nth(1)).toContainText('Dự kiến đến')
  const region = page.getByRole('region', { name: `Bản đồ tuyến ${TRIP}`, exact: true })
  await expect(region.getByRole('listitem').filter({ hasText: 'Vị trí xe:' })).toHaveText(/\(Mô phỏng\)$/)
  const markers = region.locator('.maplibregl-marker')
  const vehicle = markers.filter({ has: page.locator('svg.lucide-truck') })
  const stopMarker = (number: number) => markers.filter({ hasText: new RegExp(`^${number}$`) })
  await expect(vehicle).toHaveCount(1)

  // Xe chạy: mốc xe rời chỗ đang đứng
  const seen = await centerOf(vehicle)
  await expect.poll(async () => distance(await centerOf(vehicle), seen), { timeout: 30_000 }).toBeGreaterThan(8)

  // Tới điểm 1 xe đứng lại chờ tài xế: mốc xe nằm trên mốc điểm 1, điểm 1 ghi giờ xe đến, các điểm sau vẫn là giờ dự kiến
  await expect(stops.nth(1)).toContainText('Xe đến lúc', { timeout: 90_000 })
  await expect(bar).toContainText('đang dừng')
  await expect.poll(async () => distance(await centerOf(vehicle), await centerOf(stopMarker(1)))).toBeLessThan(2)
  await expect(stops.nth(2)).toContainText('Dự kiến đến')
  await expect(stops.nth(3)).toContainText('Dự kiến đến')
  expect(await overflowingText(page)).toStrictEqual([])

  // Tài xế hoàn tất điểm 1: xe rời điểm, chạy chặng 8 phút 38 giây (13 giây thật) tới điểm 2 rồi lại đứng chờ
  await driverCompletesStop(page, 1)
  await navigateInApp(page, '/chuyen')
  await navigateInApp(page, `/chuyen/${TRIP}`)
  await expect(stops.nth(1)).toContainText('Đã giao')
  await expect(stops.nth(1)).not.toContainText('Xe đến lúc')
  await expect(stops.nth(2)).toContainText('Xe đến lúc', { timeout: 90_000 })
  await expect.poll(async () => distance(await centerOf(vehicle), await centerOf(stopMarker(2)))).toBeLessThan(2)
  await expect(stops.nth(3)).toContainText('Dự kiến đến')

  // Lịch sử vị trí trong kho: mỗi điểm cách nhau 30 giây của kho, đều là điểm mô phỏng
  const history = await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    return getMockDb().getLocationHistory(tripId)
  }, { url: MOCK_DB, tripId: TRIP })
  expect(history.length).toBeGreaterThan(60)
  expect(new Set(history.map((point) => point.source))).toStrictEqual(new Set(['SIMULATED']))
  expect(new Set(history.slice(1).map((point, index) => Date.parse(point.recordedAt) - Date.parse(history[index]?.recordedAt ?? '')))).toStrictEqual(new Set([30_000]))
  expect(browserErrors).toStrictEqual([])
})

test('1.366 px, English: the seeded trip in transit shows its simulated vehicle standing at stop 2 without overflowing', async ({ page, login, browserErrors }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await login('/chuyen')
  // `?lang=en` đọc lúc tải trang; phiên đăng nhập nằm trong sessionStorage
  await page.goto('/chuyen/TRIP-009?lang=en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  const bar = page.getByRole('status', { name: 'Vehicle position', exact: true })
  await expect(bar.getByText('Simulated', { exact: true })).toBeVisible()
  await expect(bar.getByText('MOCK RESULT', { exact: true })).toBeVisible()
  await expect(bar).toContainText(/At \d{1,2}:\d{2}.* · standing/)
  const stops = page.getByRole('list', { name: /^Depot, then/ }).getByRole('listitem')
  await expect(stops.nth(2)).toContainText('Vehicle arrived at')
  await expect(stops.nth(3)).toContainText('Expected')
  const region = page.getByRole('region', { name: 'Route map of TRIP-009', exact: true })
  await expect(region.locator('.maplibregl-marker').filter({ has: page.locator('svg.lucide-truck') })).toHaveCount(1)
  // Mốc số của điểm đã giao mang dấu tích nổi ra ngoài góc mốc (có từ LM-097): không phải chữ tràn
  expect((await overflowingText(page)).filter((found) => !/^SPAN "\d" /.test(found))).toStrictEqual([])
  expect(browserErrors).toStrictEqual([])
})
