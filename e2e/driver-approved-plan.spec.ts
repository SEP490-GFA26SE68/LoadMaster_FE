import type { Page } from '@playwright/test'
import { attachScreenshot, expect, test } from './fixtures'
import { typeVerifyCode } from './operations-helpers'
import { heightOf, MOCK_DB, navigateInApp, overflowingText, SEED_TRIP, switchUser } from './spec-flow-helpers'

/**
 * Màn tài xế đọc revision đã duyệt (LM-061); `/tai-xe` là "Chuyến của tôi", `/tai-xe/diem-giao?chuyen=` là một chuyến (LM-087).
 * Thứ tự kỳ vọng đọc thẳng từ kho in-memory của trang qua đúng module app dùng; sau khi ghi kho chỉ đổi route phía client.
 */
const DRIVER = '/tai-xe/diem-giao'

/**
 * `{ revisionId, ids }`: kiện điểm `stop` theo `unloadingOrder` của phương án tài xế làm theo — bản kho đã xếp, kho chưa xếp thì bản
 * duyệt mới nhất.
 */
function planUnloadOrder(page: Page, tripId: string, stop: number) {
  return page.evaluate(async ({ url, tripId, stop }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const trip = await db.getTrip(tripId)
    const revisions = await db.listRevisions(tripId)
    const plan = trip.loading
      ? revisions.find((revision) => revision.id === trip.loading?.revisionId)!
      : revisions.findLast((revision) => revision.approvedAt !== undefined)!
    const prefixes = plan.request.packages.filter((pkg) => pkg.deliveryStop === stop).map((pkg) => `${pkg.id}-`)
    const ids = plan.result.placements
      .filter((p) => prefixes.some((prefix) => p.packageInstanceId.startsWith(prefix)))
      .sort((a, b) => a.unloadingOrder - b.unloadingOrder)
      .map((p) => p.packageInstanceId)
    return { revisionId: plan.id, ids }
  }, { url: MOCK_DB, tripId, stop })
}

function rowIds(page: Page) {
  return page.locator('li[data-package-id]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-package-id')))
}

test('phone: unload order equals the approved revision; Three.js loads only on "Xem vị trí hàng"', { tag: '@phone' }, async ({ page, login, browserErrors }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  // Chuyến chính kho chưa xếp: tài xế xem trước điểm 1 theo bản duyệt
  await login(`${DRIVER}?chuyen=${SEED_TRIP}`, 'driver')
  await expect(page.getByRole('heading', { name: 'Điểm 1 / 4', exact: true })).toBeVisible()

  const expected = await planUnloadOrder(page, SEED_TRIP, 1)
  expect(expected.ids.length).toBeGreaterThan(0)
  expect(await rowIds(page)).toStrictEqual(expected.ids)
  expect(await page.locator('canvas').count()).toBe(0)
  expect(requests.some((url) => /@react-three|three\.module|three\.core/.test(url)), 'driver 2D must not fetch Three.js').toBe(false)

  const viewCargo = page.getByRole('button', { name: 'Xem vị trí hàng', exact: true })
  expect((await viewCargo.boundingBox())!.height).toBeGreaterThanOrEqual(56)
  await viewCargo.tap()
  await expect(page.locator('[data-experience="driver"]')).toHaveCount(1)
  const dialog = page.getByRole('dialog', { name: 'Vị trí hàng tại điểm giao' })
  // Thứ tự dỡ của kết quả, không phải thứ tự gợi ý
  await expect(dialog).toContainText('Thứ tự dỡ · Mô phỏng không đánh dấu giao hàng')
  await expect(dialog).not.toContainText('gợi ý')
  await expect(dialog).toContainText(`Hiện tại ${expected.ids[0]}`)
  expect(browserErrors).toStrictEqual([])
})

/**
 * LM-071, LM-087: "Chuyến của tôi" và màn điểm giao chạy bằng `?lang=en` ở 390×844, nút chuyển ngôn ngữ 56px, chữ tiếng Anh không
 * tràn, đổi ngôn ngữ giữa phiên giữ điểm giao và kiện đã đánh dấu. Tải trang để đặt `?lang` trước mọi lần ghi kho.
 */
test('phone: the driver screens run in English and switching language mid-delivery keeps the stop', { tag: '@phone' }, async ({ page, login, browserErrors }, testInfo) => {
  await login('/tai-xe', 'driver')
  await page.goto('/tai-xe?lang=en')
  await expect(page.getByRole('heading', { level: 1, name: 'My trips', exact: true })).toBeVisible()
  const open = page.getByRole('region', { name: 'Loaded — waiting to depart' }).getByRole('link', { name: 'Open trip', exact: true })
  expect(await heightOf(open)).toBeGreaterThanOrEqual(56)
  expect(await overflowingText(page)).toStrictEqual([])
  await attachScreenshot(page, testInfo, 'driver-list-en-phone')

  await open.tap()
  await expect(page.getByRole('heading', { name: 'Stop 1 / 3', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View cargo positions', exact: true })).toBeVisible()
  const english = page.getByRole('button', { name: 'EN English', exact: true })
  const vietnamese = page.getByRole('button', { name: 'VI Tiếng Việt', exact: true })
  await expect(english).toHaveAttribute('aria-pressed', 'true')
  expect(await heightOf(english)).toBeGreaterThanOrEqual(56)
  expect(await heightOf(vietnamese)).toBeGreaterThanOrEqual(56)
  expect(await overflowingText(page)).toStrictEqual([])
  await attachScreenshot(page, testInfo, 'driver-en-phone')

  // FE-6-06: xuất phát, bấm "Đã đến" rồi mới dỡ — dỡ bằng hộp đối chiếu (gõ mã của bên gửi), không có nút đánh dấu tay
  await page.getByRole('button', { name: 'Depart', exact: true }).tap()
  const arrive = page.getByRole('button', { name: 'Arrived at stop 1', exact: true })
  expect(await heightOf(arrive)).toBeGreaterThanOrEqual(56)
  expect(await overflowingText(page)).toStrictEqual([])
  await arrive.tap()
  const first = await planUnloadOrder(page, 'TRIP-010', 1)
  await page.getByRole('button', { name: 'Verify unloading', exact: true }).tap()
  const verify = page.getByRole('dialog', { name: 'Verify unloading at stop 1' })
  await typeVerifyCode(verify, first.ids[0] ?? '', 'QR code or sender code')
  await expect(verify.getByText(new RegExp(`^Just unloaded ${first.ids[0]} · `))).toBeVisible()
  expect(await overflowingText(page)).toStrictEqual([])
  await verify.getByRole('button', { name: 'Close', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Report an issue', exact: true })).toBeVisible()
  expect(await overflowingText(page)).toStrictEqual([])
  await attachScreenshot(page, testInfo, 'driver-en-phone-delivering')

  await vietnamese.tap()
  await expect(page.getByRole('heading', { name: 'Điểm 1 / 3', exact: true })).toBeVisible()
  await expect(page.locator(`li[data-package-id="${first.ids[0]}"]`)).toHaveAttribute('data-state', 'unloaded')
  await expect(page.locator(`li[data-package-id="${first.ids[0]}"]`)).toContainText('Đã dỡ · gõ mã')
  await english.tap()
  await expect(page.getByRole('heading', { name: 'Stop 1 / 3', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('a newly approved revision reaches the driver screen without reload', async ({ page, login, browserErrors }) => {
  // Bản seed đã duyệt không có nút Duyệt (LM-094): điều phối viên duyệt lại revision nguồn chưa duyệt REV-001
  await login(`/chuyen/${SEED_TRIP}/phuong-an?revision=REV-001`, 'dispatcher')
  await page.locator('canvas').waitFor()
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  await page.getByRole('dialog', { name: 'Duyệt phương án này?' }).getByRole('button', { name: 'Duyệt', exact: true }).click()
  await expect(page.getByText('Đã duyệt phương án.')).toBeVisible()
  await page.waitForURL(/\/phuong-an\?revision=REV-(?!001)/)

  // Tài xế của chuyến (tài khoản demo) đăng nhập ngay trong app: tải lại trang là mất bản vừa duyệt
  await switchUser(page, 'driver')
  await navigateInApp(page, `${DRIVER}?chuyen=${SEED_TRIP}`)
  await expect(page.getByRole('heading', { name: 'Điểm 1 / 4', exact: true })).toBeVisible()
  const expected = await planUnloadOrder(page, SEED_TRIP, 1)
  expect(expected.revisionId).not.toBe('REV-002')
  await expect.poll(() => rowIds(page)).toStrictEqual(expected.ids)
  expect(browserErrors).toStrictEqual([])
})
