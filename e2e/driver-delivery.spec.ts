import { expect, test } from './fixtures'
import { heightOf, MOCK_DB, overflowingText } from './spec-flow-helpers'

/**
 * LM-087: tài xế demo giao hết chuyến đã xếp xong `TRIP-010` (3 điểm, 210 kiện) trên điện thoại, báo một sự cố, thấy tổng kết;
 * điều phối viên đọc cùng kho thấy chuyến "Đã giao" và sự cố. Kho nằm trong bộ nhớ trang: chỉ bấm trong app, không tải lại trang.
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-010'

test('phone: the demo driver delivers every stop, reports one issue and sees the trip summary', { tag: '@phone' }, async ({ page, login, browserErrors }) => {
  await login('/tai-xe', 'driver')
  const card = page.getByRole('region', { name: 'Xếp xong — chờ xuất phát' }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: TRIP, exact: true }) })
  const open = card.getByRole('link', { name: 'Mở chuyến', exact: true })
  expect(await heightOf(open)).toBeGreaterThanOrEqual(56)
  await open.tap()

  const heading = (stop: number) => page.getByRole('heading', { level: 1, name: `Điểm ${stop} / 3`, exact: true })
  await expect(heading(1)).toBeVisible()
  const start = page.getByRole('button', { name: 'Bắt đầu giao', exact: true })
  expect(await heightOf(start)).toBeGreaterThanOrEqual(56)
  await start.tap()
  const complete = page.getByRole('button', { name: 'Hoàn tất điểm giao', exact: true })
  await expect(complete).toBeDisabled()
  await expect(page.getByRole('link', { name: /^Gọi / })).toHaveAttribute('href', /^tel:\d{9,11}$/)

  // Kiện mỗi điểm theo thứ tự dỡ của phương án kho đã xếp
  const stops = await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const trip = await db.getTrip(tripId)
    const plan = await db.getRevision(trip.loading?.revisionId ?? '')
    return [1, 2, 3].map((stop) => {
      const prefixes = plan.request.packages.filter((pkg) => pkg.deliveryStop === stop).map((pkg) => `${pkg.id}-`)
      return plan.result.placements
        .filter((p) => prefixes.some((prefix) => p.packageInstanceId.startsWith(prefix)))
        .sort((a, b) => a.unloadingOrder - b.unloadingOrder)
        .map((p) => p.packageInstanceId)
    })
  }, { url: MOCK_DB, tripId: TRIP })
  const [first = [], second = [], third = []] = stops
  const refused = first[0] ?? ''

  // Điểm 1: khách từ chối kiện đầu, dỡ các kiện còn lại
  await page.getByRole('button', { name: 'Báo sự cố', exact: true }).tap()
  const dialog = page.getByRole('dialog', { name: 'Báo sự cố tại điểm 1' })
  await expect(dialog.getByRole('combobox', { name: 'Kiện', exact: true })).toHaveValue(refused)
  await dialog.getByText('Khách từ chối', { exact: true }).tap()
  await dialog.getByRole('textbox', { name: 'Ghi chú', exact: true }).fill('Khách đổi đơn, hẹn giao lại')
  const submit = dialog.getByRole('button', { name: 'Ghi sự cố', exact: true })
  expect(await heightOf(submit)).toBeGreaterThanOrEqual(56)
  // Hộp thoại vừa bề ngang điện thoại 390px
  expect(await overflowingText(page)).toStrictEqual([])
  await submit.tap()
  await expect(dialog).toBeHidden()
  await expect(page.locator(`li[data-package-id="${refused}"]`)).toHaveAttribute('data-state', 'issue')

  for (const [index, ids] of [first.slice(1), second, third].entries()) {
    for (const id of ids) await page.getByRole('button', { name: `Đánh dấu đã dỡ ${id}`, exact: true }).tap()
    await expect(page.getByText('Mọi kiện của điểm này đã dỡ hoặc đã báo sự cố.', { exact: true })).toBeVisible()
    await expect(complete).toBeEnabled()
    await complete.tap()
    if (index < 2) await expect(heading(index + 2)).toBeVisible()
  }

  await expect(page.getByRole('heading', { level: 1, name: 'Tổng kết chuyến', exact: true })).toBeVisible()
  await expect(page.getByText(`Đã giao xong chuyến ${TRIP}`, { exact: true })).toBeVisible()
  const fact = (label: string) => page.getByText(label, { exact: true }).locator('xpath=following-sibling::dd[1]')
  await expect(fact('Số điểm giao')).toHaveText('3')
  await expect(fact('Kiện đã giao')).toHaveText('209')
  const issues = page.getByRole('region', { name: 'Sự cố', exact: true })
  await expect(issues.getByRole('listitem')).toHaveCount(1)
  await expect(issues).toContainText('Khách từ chối')
  await expect(issues).toContainText(`${refused} · Điểm 1`)
  await expect(issues).toContainText('Khách đổi đơn, hẹn giao lại')
  expect(await overflowingText(page)).toStrictEqual([])

  // Điều phối viên đọc cùng kho: chuyến Đã giao, đúng một sự cố
  const store = await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb, tripStatus } = (await import(url)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(tripId)
    return {
      status: tripStatus(trip),
      issues: trip.delivery?.issues.map((issue) => [issue.kind, issue.packageInstanceId, issue.stopNumber, issue.reportedBy]),
    }
  }, { url: MOCK_DB, tripId: TRIP })
  expect(store).toStrictEqual({ status: 'DELIVERED', issues: [['refused', refused, 1, 'US-0004']] })

  // Về danh sách: chuyến nằm ở nhóm đã hoàn thành
  await page.getByRole('link', { name: 'Về danh sách chuyến', exact: true }).last().tap()
  await expect(page.getByRole('region', { name: 'Đã giao gần đây' }).getByRole('heading', { name: TRIP, exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
