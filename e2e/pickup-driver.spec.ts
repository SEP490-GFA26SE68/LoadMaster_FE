import { expect, test } from './fixtures'
import { typeVerifyCode, unloadStopInStore } from './operations-helpers'
import { heightOf, MOCK_DB, navigateInApp, overflowingText, signInWith } from './spec-flow-helpers'

/**
 * FE-7-05: tài xế của `TRIP-009` (Ngô Văn Bảo) nhận hàng dọc đường trên điện thoại. Điều phối viên đã duyệt một yêu cầu hai kiện (ghi thẳng
 * vào kho của trang — kịch bản này không kiểm bước duyệt, `pickup-approve.spec.ts` đã kiểm), tài xế xong điểm 2; từ đó mọi bước của tài xế đi
 * bằng giao diện: tới điểm nhận, đối chiếu từng kiện bằng mã gõ, hoàn tất điểm nhận, rồi dỡ hai kiện ở điểm giao mới cùng hàng của phương
 * án. Một tab, không tải lại trang.
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-009'

type PickupPackages = { id: string; token: string }[]

/** Điều phối viên duyệt yêu cầu hai kiện; tài xế dỡ xong và hoàn tất điểm 2. Trả mã kiện nhận và mã QR của chúng. */
function approveAndReachPickupStop(page: import('@playwright/test').Page): Promise<PickupPackages> {
  return page.evaluate(async ({ db: dbUrl, flow, trip }) => {
    const { getMockDb } = (await import(dbUrl)) as typeof import('@/lib/mock-db')
    const { unloadStop } = (await import(flow)) as typeof import('@/test/trip-flow')
    const db = getMockDb()
    db.restoreSession('US-0001')
    const request = await db.createPickupRequest(trip, {
      pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An', lat: 10.928, lng: 106.712 },
      delivery: { name: 'Bếp ăn KCN Sóng Thần', address: '12 Đường số 6, KCN Sóng Thần 1, Dĩ An', lat: 10.893, lng: 106.75 },
      packages: [
        { packageCode: 'HG-0901', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' },
        { packageCode: 'HG-0902', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 14.5, handlingClass: 'STANDARD' },
      ],
    })
    const { packages } = await db.approvePickupRequest(trip, request.id, { overrideReason: 'Khách quen, xe còn chỗ' })
    db.restoreSession('US-0006')
    await unloadStop(db, trip, 2)
    await db.completeStop(trip, 2)
    const labels = await db.listTripLabels(trip)
    return packages.map((pkg) => ({ id: pkg.id, token: labels.find((label) => label.packageInstanceId === pkg.id)?.qrToken ?? '' }))
  }, { db: MOCK_DB, flow: '/src/test/trip-flow.ts', trip: TRIP })
}

test('phone: the driver reaches the pickup stop, checks both packages in, completes it, then unloads them at the new delivery stop and finishes the trip', { tag: '@phone' }, async ({ page, browserErrors }) => {
  // Ngô Văn Bảo không phải tài khoản demo của vai trò tài xế: đăng nhập bằng form thật rồi mở chuyến
  await page.goto('/dang-nhap')
  await signInWith(page, 'bao.ngo@loadmaster.vn')
  const packages = await approveAndReachPickupStop(page)
  await navigateInApp(page, `/tai-xe/diem-giao?chuyen=${TRIP}`)

  // Điểm nhận nằm trong danh sách điểm với biểu tượng và chữ riêng, kiện nhận ở danh sách riêng
  await expect(page.getByRole('heading', { level: 1, name: 'Điểm 3 / 4', exact: true })).toBeVisible()
  await page.getByText('Các điểm của chuyến (4)', { exact: true }).tap()
  const stops = page.getByRole('list', { name: 'Các điểm của chuyến', exact: true }).getByRole('listitem')
  await expect(stops).toHaveCount(4)
  await expect(stops.nth(2)).toContainText('Điểm nhận hàng')
  await expect(stops.nth(2)).toHaveAttribute('data-stop-kind', 'PICKUP')
  await expect(stops.nth(3)).toContainText('Điểm giao hàng')
  const cargo = page.getByRole('region', { name: 'Kiện nhận dọc đường', exact: true })
  await expect(cargo.getByRole('listitem')).toHaveCount(2)
  await expect(cargo.getByText('Chưa nhận', { exact: true })).toHaveCount(2)

  // Cả hai kiện nhận vừa vùng đã trống nên có chỗ trong khung 3D (FE-BL-01): cạnh khung không còn danh sách "chưa có chỗ"
  await page.getByRole('button', { name: 'Xem vị trí hàng', exact: true }).tap()
  const viewer = page.getByRole('dialog', { name: 'Vị trí hàng tại điểm giao', exact: true })
  await expect(viewer.locator('canvas')).toBeVisible()
  await expect(viewer.getByRole('region', { name: 'Kiện nhận dọc đường — chưa có chỗ trên xe', exact: true })).toHaveCount(0)
  await viewer.getByRole('button', { name: 'Đóng 3D', exact: true }).tap()
  await expect(viewer).toBeHidden()

  // Tới điểm: bấm "Đã đến" rồi đối chiếu từng kiện; chưa đủ kiện thì chưa hoàn tất được
  const arrive = page.getByRole('button', { name: 'Đã đến điểm 3', exact: true })
  expect(await heightOf(arrive)).toBeGreaterThanOrEqual(56)
  await arrive.tap()
  const complete = page.getByRole('button', { name: 'Hoàn tất điểm nhận', exact: true })
  await expect(complete).toBeDisabled()
  expect(await heightOf(complete)).toBeGreaterThanOrEqual(56)
  const scan = page.getByRole('button', { name: 'Đối chiếu kiện nhận', exact: true })
  expect(await heightOf(scan)).toBeGreaterThanOrEqual(56)
  await scan.tap()
  const dialog = page.getByRole('dialog', { name: 'Đối chiếu kiện nhận tại điểm 3', exact: true })
  await typeVerifyCode(dialog, packages[0]!.token)
  await expect(dialog.getByRole('status')).toHaveText(`Vừa nhận ${packages[0]!.id} · HG-0901.`)
  await typeVerifyCode(dialog, packages[1]!.token)
  await expect(dialog).toBeHidden()
  await expect(cargo.getByText('Đã nhận · gõ mã', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Mọi kiện của điểm nhận này đã đối chiếu.', { exact: true })).toBeVisible()
  expect(await overflowingText(page)).toStrictEqual([])
  await expect(complete).toBeEnabled()
  await complete.tap()

  // Điểm giao: hàng của phương án đã dỡ trong kho; hai kiện nhận dỡ bằng chính hộp đối chiếu rồi chuyến xong
  await expect(page.getByRole('heading', { level: 1, name: 'Điểm 4 / 4', exact: true })).toBeVisible()
  await unloadStopInStore(page, TRIP, 4, packages.map((pkg) => pkg.id))
  await navigateInApp(page, '/tai-xe')
  await navigateInApp(page, `/tai-xe/diem-giao?chuyen=${TRIP}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Điểm 4 / 4', exact: true })).toBeVisible()
  await expect(cargo.getByText('Chưa dỡ', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Đối chiếu kiện dỡ', exact: true }).tap()
  const unload = page.getByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 4', exact: true })
  await typeVerifyCode(unload, packages[0]!.token)
  await expect(unload.getByRole('status')).toHaveText(`Vừa dỡ ${packages[0]!.id} · HG-0901.`)
  await typeVerifyCode(unload, packages[1]!.token)
  await expect(unload).toBeHidden()
  const finish = page.getByRole('button', { name: 'Hoàn tất điểm giao', exact: true })
  await expect(finish).toBeEnabled()
  await finish.tap()
  await expect(page.getByText('Đã giao xong chuyến TRIP-009', { exact: true })).toBeVisible()

  const final = await page.evaluate(async ({ db: dbUrl, trip, ids }) => {
    const { getMockDb } = (await import(dbUrl)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    return {
      request: (await db.listPickupRequests(trip)).find((item) => item.status === 'DELIVERED')?.id,
      statuses: await Promise.all(ids.map(async (id) => (await db.getPackage(id)).status)),
      placed: (await db.listPickupRequests(trip)).find((item) => item.status === 'DELIVERED')?.layout?.placements.length,
    }
  }, { db: MOCK_DB, trip: TRIP, ids: packages.map((pkg) => pkg.id) })
  expect(final).toStrictEqual({ request: 'PKR-002', statuses: ['DELIVERED', 'DELIVERED'], placed: 2 })
  expect(browserErrors).toStrictEqual([])
})
