import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { stageInStore, typeVerifyCode } from './operations-helpers'
import { MOCK_DB, navigateInApp, switchUser } from './spec-flow-helpers'

/**
 * Xác nhận tay và việc duyệt của điều phối viên (FE-6-03 mức 3, FE-6-04), đi trên **một tab** (D-95): kho mock nằm trong bộ nhớ trang,
 * nên đổi người ngay trong app (`switchUser`), không tải lại trang. Kho xác nhận tay một kiện → chưa hoàn tất xếp được → điều phối
 * viên nhận chuông, từ chối kèm lý do → kho nhận chuông, kiểm lại và gửi lại → điều phối viên duyệt → kho hoàn tất xếp.
 */
test.use({ collectConsoleErrors: true })

const SAMPLES = '/src/test/mock-db-samples.ts'

/** Chuyến hai thùng (`PKG-001-01` xếp trước, `PKG-002-01` xếp sau) đã duyệt; kho đã bắt đầu và soạn đủ, đang ở bước Xếp. */
async function stagedTwoCartonTrip(page: Page) {
  const tripId = await page.evaluate(async ({ db, samples }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const sample = (await import(samples)) as typeof import('@/test/mock-db-samples')
    const store = getMockDb()
    const trip = await store.createTrip({ ...sample.twoCartonTrip(), driverId: 'US-0004' })
    const revision = await store.addRevision({ tripId: trip.id, request: sample.twoCartonRequest(), result: sample.twoCartonResult() })
    await store.approveRevision(revision.id, [])
    await store.startLoading(trip.id)
    return trip.id
  }, { db: MOCK_DB, samples: SAMPLES })
  await stageInStore(page, tripId)
  return tripId
}

async function confirmManually(page: Page, step: number, reason: string) {
  await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: `Đối chiếu kiện bước ${step}` })
  await dialog.getByRole('tab', { name: 'Xác nhận tay', exact: true }).click()
  // Xếp theo thứ tự: chỉ kiện của bước hiện tại chọn được, và được chọn sẵn
  await expect(dialog.getByRole('radio', { name: /PKG-001-01/ })).toBeChecked()
  await dialog.getByRole('radio', { name: reason, exact: true }).check()
  await dialog.getByRole('button', { name: 'Gửi xác nhận tay', exact: true }).click()
  await expect(dialog).toBeHidden()
}

/** Chờ mọi toast tự tắt: toast nằm trên các nút góc phải, và máy chậm không kịp bấm nút đóng của nó. */
const toastsGone = (page: Page) => expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })

test('one tab: a manual confirmation blocks finishing; the dispatcher rejects it, then approves the next one; the warehouse finishes', async ({ page, login, browserErrors }) => {
  test.slow()
  await login('/kho', 'warehouse')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến cần xếp', exact: true })).toBeVisible()
  const tripId = await stagedTwoCartonTrip(page)
  const heading = (id: string) => page.getByRole('heading', { level: 1, name: id, exact: true })
  const complete = page.getByRole('button', { name: 'Hoàn tất xếp hàng', exact: true })

  // Kho: nhãn kiện đầu không đọc được — xác nhận tay; kho in lại được nhãn của kiện đó
  await navigateInApp(page, `/kho?chuyen=${tripId}`)
  await expect(heading('PKG-001-01')).toBeVisible()
  await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
  const first = page.getByRole('dialog', { name: 'Đối chiếu kiện bước 1' })
  await first.getByRole('tab', { name: 'Xác nhận tay', exact: true }).click()
  await expect(first.getByRole('link', { name: 'In lại nhãn PKG-001-01', exact: true })).toHaveAttribute('href', new RegExp(`^/kien-hang/nhan\\?kien=PK-\\d+&tu=kho&phien=${tripId}$`))
  await first.getByRole('button', { name: 'Đóng', exact: true }).click()
  await confirmManually(page, 1, 'Nhãn rách / mất')
  await expect(heading('PKG-002-01')).toBeVisible()
  await expect(page.getByText('Còn 1 xác nhận tay chờ điều phối viên duyệt.', { exact: true })).toBeVisible()

  // Kiện cuối đối chiếu bằng mã của bên gửi: có kết quả, nhưng còn xác nhận tay chờ duyệt — không hoàn tất được, lý do tại chỗ
  await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
  await typeVerifyCode(page.getByRole('dialog', { name: 'Đối chiếu kiện bước 2' }), 'pkg-002-01')
  await expect(complete).toBeDisabled()
  await expect(page.getByText('Mọi kiện đã có kết quả, nhưng còn 1 xác nhận tay chờ điều phối viên duyệt nên chưa hoàn tất xếp hàng được.', { exact: true })).toBeVisible()
  // Kho tự chặn dù giao diện bị bỏ qua
  expect(await page.evaluate(async ({ db, id }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    return getMockDb().completeLoading(id).then(() => 'completed', (error: { code?: string }) => error.code)
  }, { db: MOCK_DB, id: tripId })).toBe('MANUAL_CONFIRM_PENDING')
  await toastsGone(page)

  // Điều phối viên: chuông báo xác nhận tay mới, mở chuyến, từ chối kèm lý do
  await switchUser(page, 'dispatcher')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  const requested = page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Gửi xác nhận tay chờ duyệt' })
  await expect(requested).toHaveCount(1)
  await expect(requested).toContainText(tripId)
  await requested.click()
  await page.waitForURL(new RegExp(`/chuyen/${tripId}$`))
  const card = page.getByRole('region', { name: 'Xác nhận tay chờ duyệt' })
  await expect(card).toContainText('PKG-001-01')
  await expect(card).toContainText('Xếp hàng')
  await expect(card).toContainText('Lê Văn Hải gửi lúc')
  await expect(card).toContainText('Lý do: Nhãn rách / mất')
  await expect(page.locator('header').getByText('Chờ duyệt xác nhận tay (1)', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Từ chối xác nhận tay PKG-001-01', exact: true }).click()
  const reject = page.getByRole('dialog', { name: 'Từ chối xác nhận tay PKG-001-01?' })
  await reject.getByRole('button', { name: 'Từ chối xác nhận', exact: true }).click()
  await expect(reject.getByText('Ghi lý do từ chối.', { exact: true })).toBeVisible()
  await reject.getByRole('textbox', { name: 'Lý do từ chối', exact: true }).fill('Ảnh chụp cho thấy sai kiện')
  await reject.getByRole('button', { name: 'Từ chối xác nhận', exact: true }).click()
  await expect(card).toHaveCount(0)
  await toastsGone(page)

  // Kho: chuông báo lần bị từ chối, thẻ chuyến nói còn kiện phải kiểm lại; mở chuyến thì bước hiện tại quay về đúng kiện đó
  await switchUser(page, 'warehouse')
  const tripCard = page.getByRole('list', { name: 'Đang xếp hàng', exact: true }).getByRole('listitem').filter({ has: page.getByRole('heading', { name: tripId, exact: true }) })
  await expect(tripCard).toContainText('Điều phối viên từ chối 1 xác nhận tay: mở chuyến để kiểm lại kiện.')
  await page.getByRole('button', { name: 'Thông báo, 1 chưa đọc', exact: true }).click()
  const rejected = page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Từ chối xác nhận tay' })
  await expect(rejected).toContainText(tripId)
  await expect(rejected).toContainText('Lý do: Ảnh chụp cho thấy sai kiện')
  await rejected.click()
  await page.waitForURL((url) => url.pathname === '/kho' && url.searchParams.get('chuyen') === tripId)
  await expect(heading('PKG-001-01')).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Điều phối viên từ chối xác nhận tay kiện PKG-001-01' })).toContainText('Lý do: Ảnh chụp cho thấy sai kiện')
  await confirmManually(page, 1, 'QR không đọc được')
  await expect(complete).toBeDisabled()
  await toastsGone(page)

  // Điều phối viên duyệt: kiện giữ kết quả, không còn gì chờ
  await switchUser(page, 'dispatcher')
  await navigateInApp(page, `/chuyen/${tripId}`)
  await card.getByRole('button', { name: 'Duyệt xác nhận tay PKG-001-01', exact: true }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Chờ duyệt xác nhận tay (1)', { exact: true })).toHaveCount(0)
  await toastsGone(page)

  // Kho hoàn tất xếp
  await switchUser(page, 'warehouse')
  await tripCard.getByRole('link', { name: 'Tiếp tục xếp (2/2)', exact: true }).click()
  await expect(complete).toBeEnabled()
  await complete.click()
  await expect(page.getByRole('heading', { level: 1, name: `Đã xếp xong chuyến ${tripId}` })).toBeVisible()

  const store = await page.evaluate(async ({ db, id }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(id)
    return { phase: trip.phase, verified: trip.verifications?.map((entry) => [entry.packageInstanceId, entry.method, entry.manual?.status ?? null, entry.by, entry.manual?.decidedBy ?? null]) }
  }, { db: MOCK_DB, id: tripId })
  expect(store).toStrictEqual({
    phase: 'loaded',
    // Hai lần soạn bằng mã QR, xác nhận tay bị từ chối, kiện thứ hai gõ mã, rồi xác nhận tay được duyệt
    verified: [
      ['PKG-001-01', 'QR', null, 'US-0003', null], ['PKG-002-01', 'QR', null, 'US-0003', null],
      ['PKG-001-01', 'MANUAL', 'MANUAL_REJECTED', 'US-0003', 'US-0001'], ['PKG-002-01', 'CODE', null, 'US-0003', null],
      ['PKG-001-01', 'MANUAL', 'MANUAL_APPROVED', 'US-0003', 'US-0001'],
    ],
  })
  expect(browserErrors).toStrictEqual([])
})
