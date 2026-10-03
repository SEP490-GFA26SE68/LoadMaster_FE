import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { heightOf, MOCK_DB, navigateInApp } from './spec-flow-helpers'

/**
 * LM-104, luồng 5 (Execute): kho đối chiếu kiện khi xếp bằng mã trên nhãn (đúng kiện thì sang bước sau, sai kiện thì nói rõ và không
 * ghi; hộp đối chiếu ba mức từ FE-6-03 — máy chạy test không có BarcodeDetector nên đi mức gõ mã), xếp xong ghi số seal; tài xế đối
 * chiếu khi dỡ (kiện của điểm khác được giải thích); báo cáo chuyến TRIP-007 và bản in; danh mục loại xe (thêm, sửa, gắn xe,
 * xoá bị chặn khi còn xe, xoá). Kho dữ liệu nằm trong bộ nhớ trang: chỉ bấm trong app, không tải lại trang giữa chừng.
 */
test.use({ collectConsoleErrors: true })

const SAMPLES = '/src/test/mock-db-samples.ts'

/**
 * Chuyến hai thùng (`PKG-001-01` điểm 3 xếp trước, `PKG-002-01` điểm 1 xếp sau) đã duyệt; `loaded` thì kho đã xếp xong. Trả mã chuyến
 * và mã QR của từng kiện.
 */
async function twoCartonTrip(page: Page, stage: 'approved' | 'loaded') {
  return page.evaluate(async ({ db, samples, stage }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const sample = (await import(samples)) as typeof import('@/test/mock-db-samples')
    const store = getMockDb()
    const trip = await store.createTrip({ ...sample.twoCartonTrip(), driverId: 'US-0004' })
    const revision = await store.addRevision({ tripId: trip.id, request: sample.twoCartonRequest(), result: sample.twoCartonResult() })
    await store.approveRevision(revision.id, [])
    if (stage === 'loaded') {
      await store.startLoading(trip.id)
      for (const id of ['PKG-001-01', 'PKG-002-01']) await store.recordLoadingStep(trip.id, { packageInstanceId: id, outcome: 'loaded' })
      await store.completeLoading(trip.id)
    }
    const labels = await store.listTripLabels(trip.id)
    return { tripId: trip.id, token: Object.fromEntries(labels.map((label) => [label.packageInstanceId, label.qrToken])) }
  }, { db: MOCK_DB, samples: SAMPLES, stage })
}

test('tablet: the warehouse verifies a wrong package (explained, not recorded), the right ones by sender code and QR code, and records the seal', { tag: '@tablet' }, async ({ page, login, browserErrors }) => {
  await login('/kho', 'warehouse')
  await expect(page.getByRole('heading', { name: 'Chuyến cần xếp' })).toBeVisible()
  const { tripId, token } = await twoCartonTrip(page, 'approved')
  await navigateInApp(page, `/kho?chuyen=${tripId}`)

  const heading = (id: string) => page.getByRole('heading', { level: 1, name: id, exact: true })
  await expect(heading('PKG-001-01')).toBeVisible()
  const scan = page.getByRole('button', { name: 'Đối chiếu kiện', exact: true })
  expect(await heightOf(scan)).toBeGreaterThanOrEqual(56)
  await expect(page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true })).toBeVisible()

  // Gõ mã QR của kiện xếp sau: kho từ chối, hộp nêu kiện vừa đưa và kiện bước này cần
  await scan.tap()
  const dialog = page.getByRole('dialog', { name: 'Đối chiếu kiện bước 1' })
  await expect(dialog).toContainText('Bước này cần kiện PKG-001-01')
  await expect(dialog.getByRole('tab')).toHaveText(['Quét QR', 'Gõ mã', 'Xác nhận tay'])
  await dialog.getByRole('tab', { name: 'Gõ mã', exact: true }).tap()
  const code = dialog.getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' })
  const submit = dialog.getByRole('button', { name: 'Đối chiếu mã', exact: true })
  for (const control of [dialog.getByRole('tab', { name: 'Xác nhận tay', exact: true }), code, submit]) expect(await heightOf(control)).toBeGreaterThanOrEqual(56)
  await code.fill(token['PKG-002-01'] ?? '')
  await submit.tap()
  await expect(dialog.getByRole('alert')).toContainText('Sai kiện: vừa đưa PKG-002-01')
  await expect(dialog.getByRole('alert')).toContainText('bước này cần PKG-001-01')
  const afterWrong = await page.evaluate(async ({ db, id }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    return (await getMockDb().getTrip(id)).loading?.steps.length
  }, { db: MOCK_DB, id: tripId })
  expect(afterWrong).toBe(0)

  // Gõ mã của bên gửi của đúng kiện (duy nhất trong chuyến): kiểm như quét
  await code.fill('pkg-001-01')
  await submit.tap()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Đã xếp PKG-001-01', { exact: true })).toBeVisible()
  await expect(heading('PKG-002-01')).toBeVisible()

  // Kiện cuối gõ mã in dưới hình QR: kho tự hoàn tất xếp
  await scan.tap()
  const last = page.getByRole('dialog', { name: 'Đối chiếu kiện bước 2' })
  await last.getByRole('tab', { name: 'Gõ mã', exact: true }).tap()
  await last.getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' }).fill((token['PKG-002-01'] ?? '').toLowerCase())
  await last.getByRole('button', { name: 'Đối chiếu mã', exact: true }).tap()
  await expect(page.getByRole('heading', { level: 1, name: `Đã xếp xong chuyến ${tripId}` })).toBeVisible()
  await expect(page.getByText('Đã xác nhận bằng quét QR 2 kiện', { exact: true })).toBeVisible()

  // Niêm phong: số seal không bắt buộc, ghi thì hiện trên màn xếp xong
  const seal = page.getByRole('textbox', { name: 'Số seal' })
  expect(await heightOf(seal)).toBeGreaterThanOrEqual(56)
  await seal.fill('SEAL-240927')
  await page.getByRole('button', { name: 'Ghi số seal', exact: true }).tap()
  await expect(page.getByText(/^Số seal SEAL-240927 · ghi lúc \d\d:\d\d$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đổi số seal', exact: true })).toBeVisible()

  const store = await page.evaluate(async ({ db, id }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(id)
    return {
      phase: trip.phase, seal: trip.loading?.seal?.number, via: trip.loading?.steps.map((step) => `${step.packageInstanceId}:${step.via}`),
      verified: trip.verifications?.map((entry) => `${entry.packageInstanceId}:${entry.method}:${entry.by}`),
    }
  }, { db: MOCK_DB, id: tripId })
  // Mỗi lần đối chiếu ghi cách và người làm (FE-6-03): cả hai kiện gõ mã, do nhân viên kho demo
  expect(store).toStrictEqual({
    phase: 'loaded', seal: 'SEAL-240927', via: ['PKG-001-01:qr', 'PKG-002-01:qr'], verified: ['PKG-001-01:CODE:US-0003', 'PKG-002-01:CODE:US-0003'],
  })
  expect(browserErrors).toStrictEqual([])
})

test('phone: the driver verifies a package of another stop (explained) and unloads the right one by its typed code', { tag: '@phone' }, async ({ page, login, browserErrors }) => {
  await login('/tai-xe', 'driver')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến của tôi' })).toBeVisible()
  const { tripId, token } = await twoCartonTrip(page, 'loaded')
  await navigateInApp(page, `/tai-xe/diem-giao?chuyen=${tripId}`)

  await expect(page.getByRole('heading', { level: 1, name: 'Điểm 1 / 3', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Bắt đầu giao', exact: true }).tap()
  const scan = page.getByRole('button', { name: 'Đối chiếu kiện dỡ', exact: true })
  expect(await heightOf(scan)).toBeGreaterThanOrEqual(56)
  // Đánh dấu tay vẫn còn
  await expect(page.getByRole('button', { name: 'Đánh dấu đã dỡ PKG-002-01', exact: true })).toBeVisible()

  await scan.tap()
  const dialog = page.getByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 1' })
  await expect(dialog).toContainText('Điểm 1: đã dỡ 0 / 1 kiện.')
  await dialog.getByRole('tab', { name: 'Gõ mã', exact: true }).tap()
  const input = dialog.getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' })
  expect(await heightOf(input)).toBeGreaterThanOrEqual(56)
  await input.fill(token['PKG-001-01'] ?? '')
  await input.press('Enter')
  await expect(dialog.getByRole('alert')).toContainText('Kiện PKG-001-01')
  await expect(dialog.getByRole('alert')).toContainText('thuộc điểm 3 · Siêu thị Co.opmart Biên Hoà, không phải điểm này')

  // Kiện đúng của điểm: ghi đã dỡ; hết kiện chờ dỡ thì hộp thoại tự đóng
  await input.fill(token['PKG-002-01'] ?? '')
  await input.press('Enter')
  await expect(dialog).toBeHidden()
  const row = page.locator('li[data-package-id="PKG-002-01"]')
  await expect(row).toHaveAttribute('data-state', 'unloaded')
  await expect(row).toContainText('Đã dỡ · gõ mã')
  await expect(page.getByRole('button', { name: 'Hoàn tất điểm giao', exact: true })).toBeEnabled()

  const stops = await page.evaluate(async ({ db, id }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    return (await getMockDb().getTrip(id)).delivery?.stops.map((stop) => [stop.number, stop.unloadedIds, stop.qrConfirmedIds ?? []])
  }, { db: MOCK_DB, id: tripId })
  expect(stops).toStrictEqual([[1, ['PKG-002-01'], ['PKG-002-01']], [2, [], []], [3, [], []]])
  expect(browserErrors).toStrictEqual([])
})

test('the trip report of TRIP-007 shows the recorded totals, opens from the actions menu and prints without the app shell', async ({ page, login, browserErrors }) => {
  await login('/chuyen/TRIP-007', 'dispatcher')
  await page.getByRole('button', { name: 'Thao tác', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Báo cáo chuyến' }).click()
  await page.waitForURL('**/chuyen/TRIP-007/bao-cao')
  await expect(page.getByRole('heading', { level: 1, name: 'Báo cáo chuyến', exact: true })).toBeVisible()

  const expected = await page.evaluate(async ({ db }) => {
    const { getMockDb, tripReport } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    const trip = await store.getTrip('TRIP-007')
    const report = tripReport(trip, await store.getRevision(trip.loading?.revisionId ?? ''))
    return { delivered: report.packages.delivered, loaded: report.packages.planned - report.packages.missing, planned: report.packages.planned, issues: report.issues.length, stops: report.stops.length }
  }, { db: MOCK_DB })
  expect(expected.issues).toBe(1)
  await expect(page.getByRole('group', { name: 'Điểm giao đã xong' })).toContainText(`${expected.stops} / ${expected.stops}`)
  await expect(page.getByRole('group', { name: 'Kiện đã giao' })).toContainText(`${expected.delivered} / ${expected.loaded}`)
  await expect(page.getByRole('group', { name: 'Sự cố' })).toContainText('1 kiện gặp sự cố')
  await expect(page.getByText(`${expected.delivered} / ${expected.planned} kiện đã giao · 1 sự cố`, { exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Nhà thuốc từ chối nhận vì sai số lô' })).toBeVisible()
  await expect(page.getByRole('table').first().getByRole('row')).toHaveCount(expected.stops + 1)

  // In: bản phẳng gắn vào <body>, khung ứng dụng ẩn khi in
  await page.evaluate(() => {
    window.print = () => window.dispatchEvent(new Event('beforeprint'))
  })
  await page.getByRole('button', { name: 'In báo cáo', exact: true }).click()
  const printed = page.locator('[data-print-report]')
  await expect(printed).toHaveCount(1)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#root')).toBeHidden()
  await expect(printed.getByRole('heading', { level: 1 })).toHaveText('Báo cáo chuyến TRIP-007')
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(printed).toHaveCount(0)
  expect(browserErrors).toStrictEqual([])
})

test('vehicle types: add, edit, assign to a vehicle (delete blocked while in use), unassign and delete', async ({ page, login, browserErrors }) => {
  await login('/doi-xe', 'dispatcher')
  await page.getByRole('link', { name: 'Loại xe', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Loại xe', exact: true })).toBeVisible()
  await expect(page.getByText('7 loại xe, gắn cho 7 xe', { exact: true })).toBeVisible()

  // Loại của seed còn gắn xe: Xoá mờ kèm lý do
  await page.getByRole('button', { name: 'Thao tác với Xe tải 5 tấn thùng 6 m', exact: true }).click()
  const blocked = page.getByRole('menuitem', { name: /^Xoá/ })
  await expect(blocked).toHaveAttribute('aria-disabled', 'true')
  await expect(blocked).toContainText('Còn gắn với 1 xe, gỡ khỏi xe trước khi xoá')
  await page.keyboard.press('Escape')

  // Thêm
  await page.getByRole('button', { name: 'Thêm loại xe', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: 'Thêm loại xe' })
  await dialog.getByRole('textbox', { name: 'Tên loại xe' }).fill('Xe tải 2,5 tấn thùng 4,3 m')
  await dialog.getByRole('button', { name: 'Thêm loại xe', exact: true }).click()
  await expect(dialog.getByText('Nhập số lớn hơn 0.')).toHaveCount(3 + 1)
  await dialog.getByRole('spinbutton', { name: 'Dài lòng thùng' }).fill('430')
  await dialog.getByRole('spinbutton', { name: 'Rộng lòng thùng' }).fill('180')
  await dialog.getByRole('spinbutton', { name: 'Cao lòng thùng' }).fill('185')
  await dialog.getByRole('spinbutton', { name: 'Tải trọng' }).fill('2500')
  await dialog.getByRole('button', { name: 'Thêm loại xe', exact: true }).click()
  await expect(dialog).toBeHidden()
  // Bảng loại xe là bảng đầu; bảng gắn xe cũng có tên loại trong ô chọn
  const row = page.getByRole('table').first().getByRole('row').filter({ hasText: 'Xe tải 2,5 tấn thùng 4,3 m' })
  await expect(row).toContainText('VT-008')
  await expect(row).toContainText('430 × 180 × 185 cm')
  await expect(row).toContainText('2.500 kg')
  // FE-5b-01: loại mới chưa khai giới hạn trục, độ lệch trọng tâm mặc định 15 %
  await expect(row).toContainText('Trục trước chưa khai · trục sau chưa khai')
  await expect(row).toContainText('Trọng tâm lệch tối đa 15,0%')
  await expect(page.getByText('8 loại xe, gắn cho 7 xe', { exact: true })).toBeVisible()

  // Sửa tải trọng và giới hạn xếp hàng: số sai báo ngay tại ô của nó
  await row.getByRole('button', { name: 'Thao tác với Xe tải 2,5 tấn thùng 4,3 m' }).click()
  await page.getByRole('menuitem', { name: 'Sửa', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Sửa loại xe VT-008' })
  await dialog.getByRole('spinbutton', { name: 'Tải trọng' }).fill('2400')
  const frontLimit = dialog.getByRole('spinbutton', { name: 'Giới hạn trục trước', exact: true })
  const cogOffset = dialog.getByRole('spinbutton', { name: 'Lệch trọng tâm tối đa', exact: true })
  await expect(cogOffset).toHaveValue('15')
  await frontLimit.fill('0')
  await cogOffset.fill('60')
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(frontLimit).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByText('Nhập số lớn hơn 0.', { exact: true })).toHaveCount(1)
  await expect(dialog.getByText('Nhập số lớn hơn 0 và không quá 50.', { exact: true })).toBeVisible()
  await frontLimit.fill('1800')
  await dialog.getByRole('spinbutton', { name: 'Giới hạn trục sau', exact: true }).fill('3200')
  await cogOffset.fill('12.5')
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(row).toContainText('2.400 kg')
  await expect(row).toContainText('Trục trước 1.800 kg · trục sau 3.200 kg')
  await expect(row).toContainText('Trọng tâm lệch tối đa 12,5%')

  // Gắn cho xe chưa có loại: loại mới có xe đang dùng, không xoá được
  const vehicle = await page.evaluate(async ({ db }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    const assigned = new Set((await store.listVehicleTypeAssignments()).map((item) => item.vehicleId))
    return (await store.listVehicles()).find((item) => !assigned.has(item.id))?.name ?? ''
  }, { db: MOCK_DB })
  const select = page.getByRole('combobox', { name: `Loại xe của ${vehicle}` })
  await expect(select).toHaveText('Chưa gắn loại')
  await select.click()
  await page.getByRole('option', { name: 'Xe tải 2,5 tấn thùng 4,3 m' }).click()
  await expect(row).toContainText(vehicle.split(' · ')[0] ?? vehicle)
  await expect(page.getByText('8 loại xe, gắn cho 8 xe', { exact: true })).toBeVisible()
  // Xe lấy giới hạn của loại vừa gắn (FE-5b-01)
  expect(await page.evaluate(async ({ db, name }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const found = (await getMockDb().listVehicles()).find((item) => item.name === name)
    return [found?.frontAxleLimitKg, found?.rearAxleLimitKg, found?.maxCogOffsetRatio]
  }, { db: MOCK_DB, name: vehicle })).toStrictEqual([1800, 3200, 0.125])
  await row.getByRole('button', { name: 'Thao tác với Xe tải 2,5 tấn thùng 4,3 m' }).click()
  await expect(page.getByRole('menuitem', { name: /^Xoá/ })).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')

  // Gỡ khỏi xe rồi xoá
  await select.click()
  await page.getByRole('option', { name: 'Chưa gắn loại' }).click()
  await expect(row).toContainText('Chưa gắn xe nào')
  await row.getByRole('button', { name: 'Thao tác với Xe tải 2,5 tấn thùng 4,3 m' }).click()
  await page.getByRole('menuitem', { name: 'Xoá', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Xoá loại xe Xe tải 2,5 tấn thùng 4,3 m?' })
  await confirm.getByRole('button', { name: 'Xoá loại xe', exact: true }).click()
  await expect(confirm).toBeHidden()
  await expect(row).toHaveCount(0)
  await expect(page.getByText('7 loại xe, gắn cho 7 xe', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
