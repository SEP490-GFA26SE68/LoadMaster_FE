import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { loadInStore, loadingOrderOf, stageInStore, typeVerifyCode } from './operations-helpers'
import { heightOf, MOCK_DB, navigateInApp, SEED_TRIP } from './spec-flow-helpers'

/**
 * LM-086, FE-6-02, FE-6-05: nhân viên kho chọn chuyến ở `/kho`, soạn hàng (không cần thứ tự, báo thiếu một kiện rồi tìm thấy lại), xếp
 * theo thứ tự xếp — mỗi kiện phải đối chiếu, sai thứ tự thì không ghi —, bỏ lại một kiện hỏng, rời phiên rồi vào lại thì tiếp tục đúng
 * bước, và kết thúc ở "Xếp xong — chờ xuất phát". Kho dữ liệu nằm trong bộ nhớ trang: chỉ bấm trong app, không tải lại trang giữa
 * chừng. Chuyến seed có 132 kiện: vài kiện đi qua hộp đối chiếu, phần còn lại ghi thẳng vào kho của trang (`operations-helpers.ts`).
 */
test.use({ collectConsoleErrors: true })

/** Rời phiên rồi mở lại: màn đọc lại tiến độ kho vừa ghi thẳng vào kho của trang. */
async function reopen(page: Page) {
  await navigateInApp(page, '/kho')
  await navigateInApp(page, `/kho?chuyen=${SEED_TRIP}`)
}

test('tablet: stage in any order with a shortage found again, load in order by verification, leave a damaged package, resume and finish', { tag: '@tablet' }, async ({ page, login, browserErrors }) => {
  test.slow()
  await login('/kho', 'warehouse')
  // Thẻ của chuyến đổi nhóm theo trạng thái (FE-6-01): "Chờ soạn" lúc đầu, "Đang xếp hàng" khi kho đã bắt đầu
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: SEED_TRIP, exact: true }) })
  await expect(page.getByRole('list', { name: 'Chờ soạn', exact: true }).getByRole('heading', { name: SEED_TRIP, exact: true })).toBeVisible()
  const start = card.getByRole('link', { name: 'Bắt đầu soạn hàng', exact: true })
  expect(await heightOf(start)).toBeGreaterThanOrEqual(56)
  await start.tap()

  // Bước Soạn hàng: danh sách là kiện chưa soạn
  await expect(page.getByRole('heading', { level: 1, name: 'Kiện chưa soạn (132)', exact: true })).toBeVisible()
  await expect(page.getByText('Đã soạn 0 / 132', { exact: true })).toBeVisible()
  const order = await loadingOrderOf(page, SEED_TRIP)
  const at = (step: number) => order[step - 1] ?? ''
  const row = (id: string) => page.locator(`li[data-package-id="${id}"]`)
  const verifyButton = page.getByRole('button', { name: 'Đối chiếu kiện', exact: true })
  expect(await heightOf(verifyButton)).toBeGreaterThanOrEqual(56)

  // Soạn không cần thứ tự: kiện xếp thứ 6 rồi kiện xếp thứ 2; quét lại chỉ được báo "đã soạn"; mã lạ không ghi gì
  await verifyButton.tap()
  const staging = page.getByRole('dialog', { name: 'Đối chiếu kiện vào khu chờ' })
  await typeVerifyCode(staging, at(6))
  await expect(staging.getByText(new RegExp(`^Đã soạn ${at(6)} · `))).toBeVisible()
  await typeVerifyCode(staging, at(2).toLowerCase())
  await expect(staging.getByText(new RegExp(`^Đã soạn ${at(2)} · `))).toBeVisible()
  await typeVerifyCode(staging, at(2))
  await expect(staging.getByText(new RegExp(`^Kiện ${at(2)} · .+ đã soạn rồi, không ghi lại\\.$`))).toBeVisible()
  await typeVerifyCode(staging, 'LM-0000-0000-0000')
  await expect(staging.getByRole('alert')).toHaveText(`Mã LM-0000-0000-0000 không thuộc chuyến ${SEED_TRIP}.`)
  await staging.getByRole('button', { name: 'Đóng', exact: true }).tap()
  await expect(page.getByRole('heading', { level: 1, name: 'Kiện chưa soạn (130)', exact: true })).toBeVisible()
  await expect(page.getByText('Đã soạn 2 / 132', { exact: true })).toBeVisible()

  // Báo thiếu kiện xếp đầu tiên: hỏi lại trước, rồi chờ điều phối viên quyết — kho soạn tiếp
  const report = row(at(1)).getByRole('button', { name: 'Báo thiếu', exact: true })
  expect(await heightOf(report)).toBeGreaterThanOrEqual(56)
  await report.tap()
  const confirmShortage = page.getByRole('dialog', { name: `Báo thiếu ${at(1)}?` }).getByRole('button', { name: 'Báo thiếu', exact: true })
  expect(await heightOf(confirmShortage)).toBeGreaterThanOrEqual(56)
  await confirmShortage.tap()
  await expect(row(at(1))).toContainText('Đã báo thiếu — chờ điều phối')
  await expect(page.getByText('Thiếu 1 kiện — chờ điều phối viên quyết. Soạn tiếp các kiện còn lại.', { exact: true })).toBeVisible()

  // Rời phiên bằng nút thoát — nhân viên kho về danh sách chuyến, không đăng xuất — rồi vào lại: đúng tiến độ soạn
  await page.getByRole('link', { name: 'Thoát phiên xếp hàng', exact: true }).tap()
  await page.waitForURL((url) => url.pathname === '/kho' && url.search === '')
  await expect(page.getByRole('list', { name: 'Đang xếp hàng', exact: true }).getByRole('heading', { name: SEED_TRIP, exact: true })).toBeVisible()
  await expect(card.getByText('Thiếu kiện — chờ điều phối', { exact: true })).toBeVisible()
  await card.getByRole('link', { name: 'Tiếp tục soạn (2/132)', exact: true }).tap()
  await expect(page.getByRole('heading', { level: 1, name: 'Kiện chưa soạn (130)', exact: true })).toBeVisible()

  // Tìm thấy lại kiện đang báo thiếu: quét là soạn, báo thiếu tự đóng
  await verifyButton.tap()
  await typeVerifyCode(staging, at(1))
  await expect(staging.getByText(new RegExp(`^Đã soạn ${at(1)} · `))).toBeVisible()
  await staging.getByRole('button', { name: 'Đóng', exact: true }).tap()
  await expect(page.getByText(/^Thiếu \d+ kiện — chờ điều phối viên quyết/)).toHaveCount(0)

  // Soạn đủ (129 kiện còn lại ghi thẳng vào kho của trang) thì sang bước Xếp, theo thứ tự xếp
  await stageInStore(page, SEED_TRIP)
  await reopen(page)
  const heading = (id: string) => page.getByRole('heading', { level: 1, name: id, exact: true })
  await expect(heading(at(1))).toBeVisible()
  await expect(page.getByText('Bước 1 / 132', { exact: true })).toBeVisible()
  // Không có nút xác nhận không đối chiếu, không báo thiếu ở bước xếp
  await expect(page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /thiếu|không có ở kho/i })).toHaveCount(0)

  // Sai thứ tự: kiện của bước 3 đưa ở bước 1 — nói rõ, không ghi. Đúng kiện thì sang bước sau
  await verifyButton.tap()
  const stepOne = page.getByRole('dialog', { name: 'Đối chiếu kiện bước 1' })
  await typeVerifyCode(stepOne, at(3))
  await expect(stepOne.getByRole('alert')).toContainText(`Sai kiện hoặc sai thứ tự: vừa đưa ${at(3)}`)
  await expect(stepOne.getByRole('alert')).toContainText(`bước này cần ${at(1)}`)
  await typeVerifyCode(stepOne, at(1))
  await expect(heading(at(2))).toBeVisible()
  await verifyButton.tap()
  await typeVerifyCode(page.getByRole('dialog', { name: 'Đối chiếu kiện bước 2' }), at(2))
  await expect(heading(at(3))).toBeVisible()
  await expect(page.getByText('Bước 3 / 132', { exact: true })).toBeVisible()

  // Rời phiên rồi vào lại: tiếp tục đúng bước xếp
  await page.getByRole('link', { name: 'Thoát phiên xếp hàng', exact: true }).tap()
  await page.waitForURL((url) => url.pathname === '/kho' && url.search === '')
  await expect(card.getByText('Đang xếp 2 / 132', { exact: true })).toBeVisible()
  await card.getByRole('link', { name: 'Tiếp tục xếp (2/132)', exact: true }).tap()
  await expect(heading(at(3))).toBeVisible()

  // Kiện hỏng: bước 9 là kiện đầu tiên của phương án seed không có kiện nào tựa lên — kho bỏ kiện lại và xếp tiếp
  await loadInStore(page, SEED_TRIP, at(9))
  await reopen(page)
  await expect(heading(at(9))).toBeVisible()
  const damagedButton = page.getByRole('button', { name: 'Kiện hỏng', exact: true })
  expect(await heightOf(damagedButton)).toBeGreaterThanOrEqual(56)
  await damagedButton.tap()
  const damaged = page.getByRole('dialog', { name: `Ghi ${at(9)} là kiện hỏng?` })
  await expect(damaged).toContainText('Trong phương án không kiện nào tựa lên nó: kho xếp tiếp các kiện còn lại.')
  const confirmDamaged = damaged.getByRole('button', { name: 'Ghi kiện hỏng', exact: true })
  expect(await heightOf(confirmDamaged)).toBeGreaterThanOrEqual(56)
  await confirmDamaged.tap()
  await expect(heading(at(10))).toBeVisible()
  await expect(page.getByText('Bước 10 / 132', { exact: true })).toBeVisible()

  // Cùng kho: chuyến Đang xếp hàng, dòng phụ là tiến độ xếp (FE-0-05); kiện hỏng về kho kiện kèm cờ, không còn thuộc chuyến
  const store = await page.evaluate(async ({ db, tripId, damagedId }) => {
    const { getMockDb, leftOutIds, tripStatus, tripSubStatus } = (await import(db)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(tripId)
    const revisions = await getMockDb().listRevisions(tripId)
    const label = (await getMockDb().listTripLabels(tripId)).find((item) => item.packageInstanceId === damagedId)
    const pkg = await getMockDb().getPackage(label?.poolPackageId ?? '')
    return { status: tripStatus(trip), sub: tripSubStatus(trip, revisions), leftOut: [...leftOutIds(trip)], pool: [pkg.status, pkg.flags, pkg.tripId ?? null] }
  }, { db: MOCK_DB, tripId: SEED_TRIP, damagedId: at(9) })
  expect(store).toStrictEqual({ status: 'LOADING', sub: { kind: 'loading', recorded: 9, total: 132 }, leftOut: [at(9)], pool: ['IMPORTED', ['DAMAGED'], null] })

  // Xếp nốt (ghi thẳng vào kho của trang) rồi hoàn tất: "Xếp xong — chờ xuất phát", kiện hỏng được liệt kê
  await loadInStore(page, SEED_TRIP)
  await reopen(page)
  await page.getByRole('button', { name: 'Hoàn tất xếp hàng', exact: true }).tap()
  await expect(page.getByRole('heading', { level: 1, name: `Đã xếp xong chuyến ${SEED_TRIP}` })).toBeVisible()
  await expect(page.getByText('Đã xếp 131 / 132 kiện', { exact: true })).toBeVisible()
  await expect(page.getByText('Xếp xong — chờ xuất phát. Đóng cửa thùng và bàn giao cho tài xế.', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Kiện hỏng, bỏ lại kho (1)' })).toContainText(at(9))
  await page.getByRole('link', { name: 'Về danh sách chuyến', exact: true }).tap()
  await expect(page.getByRole('list', { name: 'Xếp xong — chờ xuất phát', exact: true }).getByRole('heading', { name: SEED_TRIP, exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
