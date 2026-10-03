import { expect, test } from './fixtures'
import { addStop, MOCK_DB, navigateInApp, switchUser } from './spec-flow-helpers'

/**
 * Vòng đời chuyến ở màn điều phối (LM-088): chuyến có ngày chạy và tài xế, tìm lại bằng bộ lọc của danh sách; huỷ chuyến có lý do,
 * trạng thái "Đã huỷ" và sự kiện nhật ký; huỷ theo D-91 (FE-6-07) — kiện về kho kiện, huỷ lúc đang xếp thì kho được báo dỡ phần đã xếp,
 * chuyến đang vận chuyển không huỷ được. Kho nằm trong bộ nhớ trang: đi bằng thao tác UI, không tải lại trang sau khi ghi.
 */

/** Một ngày chạy cách hôm nay một năm: seed neo theo hôm nay (D-44) nên không chuyến seed nào rơi vào ngày đó. */
function farRunDate() {
  const date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [year, month, day] = date.split('-')
  return { iso: date, shown: `${day}/${month}/${year}` }
}

test('a trip created with a run date and a driver is found again with the list filters', async ({ page, login, browserErrors }) => {
  const runDate = farRunDate()
  await login('/chuyen/moi')
  await page.getByRole('textbox', { name: 'Tên chuyến', exact: true }).fill('Tuyến Long Bình – Tân Uyên E2E')
  await page.getByLabel('Ngày chạy', { exact: true }).fill(runDate.iso)
  await page.getByRole('combobox', { name: 'Tài xế', exact: true }).click()
  await page.getByRole('option', { name: 'Trương Văn Lộc', exact: true }).click()
  await page.getByRole('combobox', { name: 'Xe', exact: true }).click()
  await page.getByRole('option', { name: 'Truck 6m', exact: true }).click()
  await page.getByLabel('Giờ xuất phát', { exact: true }).fill('06:30')
  await page.getByRole('button', { name: 'Tạo chuyến', exact: true }).click()
  await page.waitForURL(/\/chuyen\/TRIP-015$/)
  // FE-4b-04: điểm giao thêm ở Chi tiết chuyến, không nhập lúc tạo
  await addStop(page, { name: 'Kho lạnh Tân Uyên', phone: '0274 365 2288' })

  // Chi tiết: ngày chạy và giờ xuất phát ở header, tài xế cạnh xe
  await expect(page.getByText(`Ngày chạy ${runDate.shown}, xuất phát 06:30`, { exact: true })).toBeVisible()
  await expect(page.getByText('Trương Văn Lộc', { exact: true })).toBeVisible()
  await expect(page.locator('header').getByText('Nháp', { exact: true })).toBeVisible()

  // Danh sách: lọc theo tài xế và ngày chạy thì còn đúng chuyến vừa tạo
  await page.getByRole('navigation', { name: 'Vị trí trang', exact: true }).getByRole('link', { name: 'Chuyến hàng', exact: true }).click()
  await page.waitForURL(/\/chuyen$/)
  const filters = page.getByRole('search', { name: 'Tìm và lọc' })
  await filters.getByRole('combobox', { name: 'Tài xế', exact: true }).click()
  await page.getByRole('option', { name: 'Trương Văn Lộc', exact: true }).click()
  // Chờ URL nhận bộ lọc trước khi đổi bộ lọc kế: router đổi URL trong transition
  await expect(page).toHaveURL(/\?tai-xe=US-0010$/)
  // V2.3: chip "Ngày chạy" mở hai ô ngày; ngày chạy là dòng nhóm phía trên các chuyến của ngày đó (khác năm thì in cả năm)
  await filters.getByRole('button', { name: /^Ngày chạy: / }).click()
  await filters.getByLabel('Từ ngày', { exact: true }).fill(runDate.iso)
  await expect(page).toHaveURL(new RegExp(`\\?tai-xe=US-0010&tu=${runDate.iso}$`))
  const row = page.getByRole('row', { name: /TRIP-015/ })
  await expect(row).toContainText('Trương Văn Lộc')
  // Tiêu đề cột, dòng nhóm ngày chạy, dòng chuyến
  const rows = page.getByRole('row')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(1)).toContainText(`${runDate.shown}1 chuyến`)

  // Tìm bỏ dấu cũng ra
  await filters.getByRole('button', { name: 'Xoá lọc', exact: true }).click()
  await filters.getByRole('searchbox').fill('tan uyen e2e')
  await expect(page.getByRole('row')).toHaveCount(3)
  await expect(row).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('cancelling a trip needs a reason, shows "Đã huỷ" and writes the cancellation to the log', async ({ page, login, browserErrors }) => {
  await login('/chuyen/TRIP-014')
  await page.getByRole('button', { name: 'Thao tác', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Huỷ chuyến', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Huỷ chuyến TRIP-014?' })
  // Hộp nói trước kiện và yêu cầu giao đi đâu (D-91)
  await expect(dialog).toContainText('Kiện của chuyến về kho kiện, yêu cầu giao về Chờ xếp chuyến.')
  await dialog.getByRole('button', { name: 'Huỷ chuyến', exact: true }).click()
  await expect(dialog.getByText('Nhập lý do huỷ chuyến', { exact: true })).toBeVisible()
  await dialog.getByLabel('Lý do huỷ', { exact: true }).fill('Khách đổi lịch nhận hàng sang tuần sau')
  await dialog.getByRole('button', { name: 'Huỷ chuyến', exact: true }).click()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Đã huỷ chuyến TRIP-014', { exact: true })).toBeVisible()
  await expect(page.locator('header').getByText('Đã huỷ', { exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Lý do: Khách đổi lịch nhận hàng sang tuần sau' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thao tác', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Chạy tối ưu', exact: true })).toHaveCount(0)

  const latest = await page.evaluate(async (db) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const [event] = await getMockDb().listEvents({ targetId: 'TRIP-014' })
    const statuses = [...new Set((await getMockDb().listTripPackages('TRIP-014')).map((item) => item.package.status))]
    return { event, statuses }
  }, MOCK_DB)
  expect(latest.event).toMatchObject({
    action: 'trip.cancelled',
    actorId: 'US-0001',
    target: { type: 'trip', id: 'TRIP-014' },
    params: { reason: 'Khách đổi lịch nhận hàng sang tuần sau' },
  })
  // Kiện của chuyến Nháp vừa huỷ đã về kho kiện
  expect(latest.statuses).toStrictEqual(['IMPORTED'])

  await page.getByRole('navigation', { name: 'Vị trí trang', exact: true }).getByRole('link', { name: 'Chuyến hàng', exact: true }).click()
  await expect(page.getByRole('row', { name: /TRIP-014/ })).toContainText('Đã huỷ')
  expect(browserErrors).toStrictEqual([])
})

test('one tab: cancelling a trip the warehouse is loading tells the warehouse to unload it; a trip in transit cannot be cancelled (FE-6-07)', async ({ page, login, browserErrors }) => {
  // TRIP-011 (seed): kho đã soạn đủ 280 kiện và xếp 110 kiện lên xe
  await login('/chuyen/TRIP-011')
  await page.getByRole('button', { name: 'Thao tác', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Huỷ chuyến', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Huỷ chuyến TRIP-011?' })
  await expect(dialog).toContainText('Kho đã xếp 110 kiện lên xe: kho được báo để dỡ ra.')
  await dialog.getByLabel('Lý do huỷ', { exact: true }).fill('Xe hỏng máy lạnh')
  await dialog.getByRole('button', { name: 'Huỷ chuyến', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('header').getByText('Đã huỷ', { exact: true })).toBeVisible()

  const store = await page.evaluate(async (db) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const [event] = await getMockDb().listEvents({ targetId: 'TRIP-011' })
    const statuses = [...new Set((await getMockDb().listTripPackages('TRIP-011')).map((item) => item.package.status))]
    // Chuyến đang vận chuyển TRIP-009: kho từ chối — huỷ lúc đang chạy cần sự cố cấp chuyến đang mở
    const inTransit = await getMockDb().cancelTrip('TRIP-009', 'Xe hỏng').then(() => 'cancelled', (error: { code?: string }) => error.code)
    return { action: event?.action, params: event?.params, statuses, inTransit }
  }, MOCK_DB)
  expect(store).toStrictEqual({
    action: 'trip.cancelled', params: { reason: 'Xe hỏng máy lạnh', loaded: 110 }, statuses: ['IMPORTED'], inTransit: 'INVALID_TRIP_STATUS_TRANSITION',
  })
  // Chi tiết chuyến đang vận chuyển không có menu thao tác nào để huỷ
  await navigateInApp(page, '/chuyen/TRIP-009')
  await expect(page.locator('header').getByText('Đang vận chuyển', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thao tác', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })

  // Kho được báo dỡ phần đã xếp: chuông ở màn kho, rồi màn của chuyến
  await switchUser(page, 'warehouse')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  const cancelled = page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Huỷ chuyến' })
  await expect(cancelled).toHaveCount(1)
  await expect(cancelled).toContainText('TRIP-011')
  await expect(cancelled).toContainText('Đã lên xe: 110')
  await cancelled.click()
  await page.waitForURL((url) => url.pathname === '/kho' && url.searchParams.get('chuyen') === 'TRIP-011')
  await expect(page.getByText('Chuyến TRIP-011 đã huỷ: Xe hỏng máy lạnh Dỡ 110 kiện đã xếp khỏi xe.', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
