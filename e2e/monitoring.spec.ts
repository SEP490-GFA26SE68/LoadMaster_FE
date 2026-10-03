import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { MOCK_DB, navigateInApp, overflowingText, switchUser } from './spec-flow-helpers'

/**
 * FE-6-10, FE-6-11, FE-6-12: màn Giám sát, sự cố cấp chuyến, tuyến thay thế và gia hạn — cả luồng trên **một tab** (D-95): điều phối
 * viên → quản lý công ty → điều phối viên, đổi người trong app. Kho nằm trong bộ nhớ của tab: việc của kho và tài xế (xếp xong, xuất
 * phát) ghi thẳng vào kho của trang, như họ vừa làm trên cùng tab. Đồng hồ của kho tua nhanh 60 lần (`?toc-do=60`): một giây thật là
 * một phút của kho. Không chờ theo giờ cố định: mọi bước chờ tới một trạng thái của màn không lùi lại được.
 */
test.use({ collectConsoleErrors: true })

const OPTIMIZER = '/src/services/optimization/index.ts'

/**
 * Chuyến chở yêu cầu `REQ-004` (KCN Trà Nóc, Cần Thơ — khoảng 204 km đường, hơn 4 giờ của kho: xe không tới nơi trong lúc test) đã
 * duyệt, đã xếp xong và vừa xuất phát. Hạn của yêu cầu đặt sau giờ đến dự kiến 40 phút: lúc xuất phát điểm giao còn kịp hạn.
 */
async function requirementTripInTransit(page: Page): Promise<string> {
  return page.evaluate(async ({ url, optimizer, flow }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const { runMockOptimization } = (await import(optimizer)) as typeof import('@/services/optimization')
    const db = getMockDb()
    const scheduledDate = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
    const created = await db.createTrip({ name: 'Tuyến Cần Thơ', vehicleId: 'VEHICLE-005', scheduledDate, packages: [], stops: [] })
    await db.assignDeliveryRequirement('REQ-004', created.id)
    await db.optimizeTripRoute(created.id)
    const trip = await db.getTrip(created.id)
    const request = {
      vehicle: await db.getVehicle(trip.vehicleId),
      packages: trip.packages,
      settings: { method: 'MOCK' as const, timeLimitSeconds: 30, randomSeed: 20_261_004, enforceLifo: true, prioritizeLowCenterOfGravity: false },
    }
    const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request) })
    await db.approveRevision(revision.id, [], { force: true })
    // Soạn đủ rồi xếp đủ theo thứ tự xếp (FE-6-02, FE-6-05), sau đó xe xuất phát
    await ((await import(flow)) as typeof import('@/test/trip-flow')).loadTrip(db, trip.id)
    await db.startDelivery(trip.id)
    const [stop] = (await db.getTripMonitoring(trip.id)).stops
    if (!stop) throw new Error('the trip has no live stop')
    await db.updateDeliveryRequirement('REQ-004', { deadline: new Date(Date.parse(stop.eta) + 40 * 60_000).toISOString() })
    return trip.id
  }, { url: MOCK_DB, optimizer: OPTIMIZER, flow: '/src/test/trip-flow.ts' })
}

/** Ngày `YYYY-MM-DD` theo giờ của trình duyệt, cách hôm nay `days` ngày — ô ngày của form nhập theo giờ của máy. */
function localDate(page: Page, days: number): Promise<string> {
  return page.evaluate((offset) => {
    const at = new Date(Date.now() + offset * 86_400_000)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  }, days)
}

/**
 * Toast hiện ở góc phải dưới dải trời, đè lên hai công tắc lọc của danh sách, và dừng đếm giờ khi con trỏ nằm trên nó: đưa chuột ra chỗ
 * trống rồi chờ toast tự tắt trước khi bấm vào vùng đó.
 */
async function toastsGone(page: Page) {
  await page.mouse.move(8, 400)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 30_000 })
}

/** Tâm của một mốc trên bản đồ, px. */
async function centerOf(marker: Locator) {
  const box = await marker.boundingBox()
  if (!box) throw new Error('marker is not on the map')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const tripRow = (page: Page, tripId: string) => page.getByRole('list', { name: 'Chuyến đang vận chuyển', exact: true }).getByRole('listitem').filter({ hasText: tripId })
const tripPanel = (page: Page, tripId: string) => page.getByRole('region', { name: `Giám sát chuyến ${tripId}`, exact: true })

test('1.366 px: an incident on a trip in transit goes from the dispatcher to the manager and back, on one tab with the clock 60 times faster', async ({ page, login, browserErrors }) => {
  test.slow()
  await page.setViewportSize({ width: 1366, height: 768 })
  await login('/giam-sat?toc-do=60')
  await expect(page.getByRole('heading', { level: 1, name: 'Giám sát', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Giám sát · LoadMaster')
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Giám sát', exact: true })).toHaveAttribute('aria-current', 'page')
  // Điều phối viên không có tab "Sự cố cần xử lý"
  await expect(tripRow(page, 'TRIP-009')).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)

  // Một chuyến chở yêu cầu giao vừa xuất phát: màn tự thấy chuyến mới
  const tripId = await requirementTripInTransit(page)
  const row = tripRow(page, tripId)
  await expect(row).toBeVisible()
  await row.getByRole('button').click()
  await expect(row).toContainText('Điểm tiếp: điểm 1 · KCN Trà Nóc')
  await expect(row).toContainText('Kịp hạn')
  await expect(row).toContainText('Mô phỏng')
  const panel = tripPanel(page, tripId)
  await expect(panel.getByRole('status', { name: 'Vị trí xe', exact: true })).toContainText('đang chạy 50 km/h')

  // Bản đồ: hai xe đang chạy kèm nhãn mã chuyến và nguồn vị trí; điểm giao của chuyến đang chọn; danh sách cho trình đọc màn hình
  const map = page.getByRole('region', { name: 'Bản đồ các xe đang vận chuyển', exact: true })
  const markers = map.locator('.maplibregl-marker')
  await expect(markers.filter({ has: page.locator('svg.lucide-truck') })).toHaveCount(2)
  await expect(markers.filter({ hasText: `${tripId} · Mô phỏng` })).toHaveCount(1)
  await expect(markers.filter({ hasText: 'TRIP-009 · Mô phỏng' })).toHaveCount(1)
  await expect(markers.filter({ hasText: /^1$/ })).toHaveCount(1)
  await expect(map.getByRole('listitem').filter({ hasText: 'Vị trí xe:' })).toHaveCount(2)
  await expect(page.getByText('MOCK RESULT', { exact: true }).first()).toBeVisible()
  expect(await overflowingText(page)).toStrictEqual([])
  // Xe chạy: mốc xe của chuyến dời chỗ trên bản đồ
  const vehicle = markers.filter({ hasText: `${tripId} · Mô phỏng` })
  const seen = await centerOf(vehicle)
  await expect.poll(async () => Math.hypot((await centerOf(vehicle)).x - seen.x, (await centerOf(vehicle)).y - seen.y), { timeout: 30_000 }).toBeGreaterThan(8)

  // Báo sự cố 120 phút: xe mô phỏng đứng lại, giờ đến trượt theo vị trí — điểm giao thành có nguy cơ trễ
  await panel.getByRole('button', { name: 'Báo sự cố', exact: true }).click()
  const report = page.getByRole('dialog', { name: `Báo sự cố chuyến ${tripId}`, exact: true })
  await report.getByRole('radio', { name: 'Tai nạn', exact: true }).check()
  await report.getByLabel('Mô tả', { exact: true }).fill('Tai nạn chắn hai làn trên quốc lộ 1A')
  await report.getByLabel('Số phút dự kiến chậm', { exact: true }).fill('120')
  await report.getByRole('button', { name: 'Báo sự cố', exact: true }).click()
  await expect(report).toHaveCount(0)
  const incident = panel.getByRole('listitem').filter({ hasText: 'Tai nạn chắn hai làn trên quốc lộ 1A' })
  await expect(incident).toContainText('Chưa xử lý')
  await expect(incident).toContainText('Dự kiến chậm 120 phút')
  await expect(row).toContainText('1 sự cố')

  // Lọc "Có sự cố": chỉ còn chuyến có sự cố
  await toastsGone(page)
  await page.getByRole('button', { name: 'Có sự cố 1', exact: true }).click()
  await expect(tripRow(page, 'TRIP-009')).toHaveCount(0)
  await expect(row).toBeVisible()
  await toastsGone(page)
  await page.getByRole('button', { name: 'Có sự cố 1', exact: true }).click()
  await expect(tripRow(page, 'TRIP-009')).toBeVisible()
  await expect(panel.getByRole('status', { name: 'Vị trí xe', exact: true })).toContainText('đang dừng')
  await expect(row).toContainText(/Sát hạn|Trễ hạn dự kiến/, { timeout: 90_000 })
  await expect(page.getByRole('button', { name: 'Có nguy cơ trễ 1', exact: true })).toBeVisible()

  // Tìm tuyến khác: ba lựa chọn mock tới điểm kế tiếp; chọn một thì màn ghi tuyến đã chọn
  await incident.getByRole('button', { name: 'Tìm tuyến khác', exact: true }).click()
  const reroute = page.getByRole('dialog', { name: `Tìm tuyến khác cho chuyến ${tripId}`, exact: true })
  await expect(reroute.getByRole('radio')).toHaveCount(3)
  await expect(reroute.getByText('MOCK RESULT', { exact: true })).toBeVisible()
  await expect(reroute).toContainText('Thứ tự điểm giao không đổi.')
  await reroute.getByRole('radio', { name: /^Cao tốc/ }).check()
  await reroute.getByRole('button', { name: 'Chọn tuyến này', exact: true }).click()
  await expect(reroute).toHaveCount(0)
  await expect(panel).toContainText(/Tuyến đã chọn lúc \d{1,2}:\d{2}: Cao tốc · /)

  // Quá 30 phút của kho chưa xử lý: sự cố tự chuyển quản lý
  await expect(incident).toContainText('Đã chuyển quản lý', { timeout: 90_000 })
  await expect(incident).toContainText(/Tự chuyển quản lý lúc .+: quá 30 phút chưa xử lý/)
  await expect(incident.getByRole('button', { name: 'Không có tuyến khả thi — chuyển quản lý', exact: true })).toHaveCount(0)

  // Quản lý công ty: chuông báo, tab "Sự cố cần xử lý", liên hệ khách và nhập hạn mới
  await switchUser(page, 'manager')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  await expect(page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Chuyển sự cố cho quản lý' })).toHaveCount(1)
  await page.keyboard.press('Escape')
  await navigateInApp(page, '/giam-sat')
  await expect(tripPanel(page, 'TRIP-009').getByRole('button', { name: 'Báo sự cố', exact: true })).toHaveCount(0)
  const tab = page.getByRole('tab', { name: /^Sự cố cần xử lý/ })
  await expect(tab).toContainText('1')
  await tab.click()
  const escalated = page.getByRole('list', { name: 'Sự cố cần xử lý', exact: true }).getByRole('listitem').filter({ hasText: 'Tai nạn chắn hai làn trên quốc lộ 1A' })
  await expect(escalated.getByRole('link', { name: `Chuyến ${tripId}`, exact: true })).toBeVisible()
  await expect(escalated).toContainText('Điểm 1 · KCN Trà Nóc')
  await expect(escalated).toContainText(/Sát hạn|Trễ hạn dự kiến/)
  expect(await overflowingText(page)).toStrictEqual([])

  await escalated.getByRole('button', { name: 'Nhập hạn mới', exact: true }).click()
  const renegotiate = page.getByRole('dialog', { name: 'Liên hệ khách và nhập hạn mới', exact: true })
  await expect(renegotiate.getByRole('combobox', { name: 'Yêu cầu giao', exact: true })).toContainText('REQ-004 · KCN Trà Nóc · điểm 1')
  await renegotiate.getByLabel('Đã liên hệ khách', { exact: true }).fill('Đã gọi anh Phúc ở KCN Trà Nóc, đồng ý lùi hạn')
  // Hạn mới phải sau giờ hiện tại của đồng hồ: hôm qua bị kho từ chối
  await renegotiate.getByRole('textbox', { name: 'Ngày của hạn mới', exact: true }).fill(await localDate(page, -1))
  await renegotiate.getByRole('button', { name: 'Lưu hạn mới', exact: true }).click()
  await expect(page.getByText('Hạn giao phải ở tương lai.', { exact: true })).toBeVisible()
  await renegotiate.getByRole('textbox', { name: 'Ngày của hạn mới', exact: true }).fill(await localDate(page, 3))
  await renegotiate.getByRole('textbox', { name: 'Giờ của hạn mới', exact: true }).fill('10:00')
  await renegotiate.getByRole('button', { name: 'Lưu hạn mới', exact: true }).click()
  await expect(renegotiate).toHaveCount(0)
  // Hạn của điểm giao và mức hạn tính lại ngay
  await expect(escalated).toContainText('Hạn mới của REQ-004')
  await expect(escalated).toContainText('Đã nhập hạn mới — chờ điều phối viên xử lý tiếp.')
  await expect(escalated).toContainText('Kịp hạn')
  await expect(tab).toContainText('0')

  // Điều phối viên được báo để xử lý tiếp
  await switchUser(page, 'dispatcher')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  await expect(page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Liên hệ khách, nhập hạn mới' })).toHaveCount(1)
  await page.keyboard.press('Escape')
  await navigateInApp(page, `/giam-sat?chuyen=${tripId}`)
  await expect(tripRow(page, tripId)).toContainText('Kịp hạn')
  const handled = tripPanel(page, tripId).getByRole('listitem').filter({ hasText: 'Tai nạn chắn hai làn trên quốc lộ 1A' })
  await expect(handled).toContainText('Quản lý đã liên hệ khách lúc')
  await handled.getByRole('button', { name: 'Đã xử lý', exact: true }).click()
  await expect(handled).toContainText(/Đã xử lý lúc .+ bởi Nguyễn Thanh Tùng/)
  await expect(tripRow(page, tripId)).not.toContainText('sự cố')
  // Xe đang chạy chỉ đổi đường: chuyến vẫn đúng một điểm giao như lúc xuất phát
  await expect(tripPanel(page, tripId).getByRole('table', { name: 'Giờ đến từng điểm', exact: true }).getByRole('row')).toHaveCount(2)
  expect(browserErrors).toStrictEqual([])
})

test('the driver reports an incident on the road from the stop screen, and the dispatcher finds it on the monitoring screen', async ({ page, login, browserErrors }) => {
  await login('/tai-xe', 'driver')
  // Kho đã xếp xong chuyến TRIP-010 của tài xế demo; tài xế xuất phát
  await page.evaluate(async ({ url }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    await getMockDb().startDelivery('TRIP-010')
  }, { url: MOCK_DB })
  await navigateInApp(page, '/tai-xe/diem-giao?chuyen=TRIP-010')
  await page.getByRole('button', { name: 'Sự cố trên đường', exact: true }).click()
  const report = page.getByRole('dialog', { name: 'Báo sự cố chuyến TRIP-010', exact: true })
  await report.getByRole('radio', { name: 'Hỏng xe', exact: true }).check()
  await report.getByLabel('Mô tả', { exact: true }).fill('Nổ lốp sau bên phải trên xa lộ Hà Nội')
  await report.getByLabel('Số phút dự kiến chậm', { exact: true }).fill('45')
  await report.getByRole('button', { name: 'Báo sự cố', exact: true }).click()
  await expect(report).toHaveCount(0)
  await expect(page.getByText(/^Đã báo sự cố EXC-\d+$/)).toBeVisible()

  await switchUser(page, 'dispatcher')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  await expect(page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Báo sự cố chuyến' })).toHaveCount(1)
  await page.keyboard.press('Escape')
  await navigateInApp(page, '/giam-sat?chuyen=TRIP-010')
  const incident = tripPanel(page, 'TRIP-010').getByRole('listitem').filter({ hasText: 'Nổ lốp sau bên phải trên xa lộ Hà Nội' })
  await expect(incident).toContainText('Hỏng xe')
  await expect(incident).toContainText(/Báo lúc .+ bởi Phạm Quốc Dũng · Dự kiến chậm 45 phút · Xe đang tới điểm 1/)
  await expect(tripRow(page, 'TRIP-010')).toContainText('1 sự cố')
  expect(browserErrors).toStrictEqual([])
})
