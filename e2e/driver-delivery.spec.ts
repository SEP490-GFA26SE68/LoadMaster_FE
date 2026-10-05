import { expect, test } from './fixtures'
import { typeVerifyCode, unloadStopInStore } from './operations-helpers'
import { heightOf, MOCK_DB, navigateInApp, overflowingText } from './spec-flow-helpers'

/**
 * LM-087, FE-6-06: tài xế demo giao hết chuyến đã xếp xong `TRIP-010` (3 điểm, 210 kiện) trên điện thoại — Xuất phát, ở mỗi điểm bấm
 * "Đã đến" rồi mới dỡ, dỡ bằng đối chiếu, khách từ chối một kiện (Hoàn trả), hoàn tất điểm — rồi thấy tổng kết; điều phối viên đọc
 * cùng kho thấy chuyến "Đã giao" và sự cố. Kho nằm trong bộ nhớ trang: chỉ bấm trong app, không tải lại trang. Một kiện được dỡ bằng
 * hộp đối chiếu; hai trăm kiện còn lại dỡ thẳng trong kho của trang bằng chính hàm đối chiếu (`operations-helpers.ts`).
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-010'

test('phone: the demo driver departs, arrives at every stop before unloading, has one package refused and sees the trip summary', { tag: '@phone' }, async ({ page, login, browserErrors }) => {
  await login('/tai-xe', 'driver')
  const card = page.getByRole('region', { name: 'Xếp xong — chờ xuất phát' }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: TRIP, exact: true }) })
  const open = card.getByRole('link', { name: 'Mở chuyến', exact: true })
  expect(await heightOf(open)).toBeGreaterThanOrEqual(56)
  await open.tap()

  const heading = (stop: number) => page.getByRole('heading', { level: 1, name: `Điểm ${stop} / 3`, exact: true })
  await expect(heading(1)).toBeVisible()
  const start = page.getByRole('button', { name: 'Xuất phát', exact: true })
  expect(await heightOf(start)).toBeGreaterThanOrEqual(56)
  await start.tap()
  const complete = page.getByRole('button', { name: 'Hoàn tất điểm giao', exact: true })
  const scan = page.getByRole('button', { name: 'Đối chiếu kiện dỡ', exact: true })
  const arrive = (stop: number) => page.getByRole('button', { name: `Đã đến điểm ${stop}`, exact: true })
  // Đang tới điểm 1: nút chính là "Đã đến"; chưa đến thì chưa có lối dỡ, báo sự cố hay hoàn tất điểm
  await expect(page.getByText('Đang tới điểm 1. Đến nơi thì bấm Đã đến rồi mới dỡ hàng.', { exact: true })).toBeVisible()
  expect(await heightOf(arrive(1))).toBeGreaterThanOrEqual(56)
  await expect(complete).toHaveCount(0)
  await expect(scan).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Báo sự cố', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^Gọi / })).toHaveAttribute('href', /^tel:\d{9,11}$/)
  expect(await overflowingText(page)).toStrictEqual([])
  await arrive(1).tap()
  await expect(page.getByText(/^Đã đến điểm 1 lúc \d\d:\d\d\.$/)).toBeVisible()
  await expect(complete).toBeDisabled()

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

  // Điểm 1: khách từ chối kiện đầu — kiện ở lại xe —, dỡ các kiện còn lại
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
  const refusedRow = page.locator(`li[data-package-id="${refused}"]`)
  await expect(refusedRow).toHaveAttribute('data-state', 'returned')
  await expect(refusedRow).toContainText('Hoàn trả — kiện ở lại xe')

  // Một kiện dỡ bằng hộp đối chiếu (gõ mã của bên gửi); dòng kiện không có nút đánh dấu tay
  const typed = first[1] ?? ''
  await expect(page.getByRole('list', { name: 'Cửa hàng Bách Hoá Xanh Thủ Đức' }).getByRole('button')).toHaveCount(0)
  expect(await heightOf(scan)).toBeGreaterThanOrEqual(56)
  await scan.tap()
  const verify = page.getByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 1' })
  await typeVerifyCode(verify, typed.toLowerCase())
  await expect(verify.getByText(new RegExp(`^Vừa dỡ ${typed} · `))).toBeVisible()
  await verify.getByRole('button', { name: 'Đóng', exact: true }).tap()
  await expect(page.locator(`li[data-package-id="${typed}"]`)).toContainText('Đã dỡ · gõ mã')

  // Các kiện còn lại của từng điểm dỡ thẳng trong kho của trang; mở lại chuyến để màn đọc lại, rồi hoàn tất điểm bằng giao diện
  const reopen = async () => {
    await navigateInApp(page, '/tai-xe')
    await navigateInApp(page, `/tai-xe/diem-giao?chuyen=${TRIP}`)
  }
  for (const stop of [1, 2, 3]) {
    if (stop > 1) {
      await expect(complete).toHaveCount(0)
      await arrive(stop).tap()
      await expect(complete).toBeDisabled()
    }
    await unloadStopInStore(page, TRIP, stop, [refused])
    await reopen()
    await expect(page.getByText('Mọi kiện của điểm này đã dỡ hoặc đã báo sự cố.', { exact: true })).toBeVisible()
    await expect(complete).toBeEnabled()
    await complete.tap()
    if (stop < 3) await expect(heading(stop + 1)).toBeVisible()
  }
  // seed-trips.ts: TRIP-010 chở 80 + 40 kiện tới điểm 1, 45 kiện tới điểm 2, 45 kiện tới điểm 3
  expect([first.length, second.length, third.length]).toStrictEqual([120, 45, 45])

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

  // Cùng kho: chuyến Đã giao, đúng một sự cố; 209 kiện Đã giao, kiện khách từ chối Hoàn trả; mọi điểm có giờ đến
  const store = await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb, tripStatus } = (await import(url)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(tripId)
    const statuses: Record<string, number> = {}
    for (const { package: pkg } of await getMockDb().listTripPackages(tripId)) statuses[pkg.status] = (statuses[pkg.status] ?? 0) + 1
    return {
      status: tripStatus(trip),
      issues: trip.delivery?.issues.map((issue) => [issue.kind, issue.packageInstanceId, issue.stopNumber, issue.reportedBy]),
      arrived: trip.delivery?.stops.map((stop) => stop.arrivedAt !== undefined),
      statuses,
    }
  }, { url: MOCK_DB, tripId: TRIP })
  expect(store).toStrictEqual({
    status: 'DELIVERED', issues: [['refused', refused, 1, 'US-0004']], arrived: [true, true, true], statuses: { DELIVERED: 209, RETURNED: 1 },
  })

  // Về danh sách: chuyến nằm ở nhóm đã hoàn thành
  await page.getByRole('link', { name: 'Về danh sách chuyến', exact: true }).last().tap()
  await expect(page.getByRole('region', { name: 'Đã giao gần đây' }).getByRole('heading', { name: TRIP, exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
