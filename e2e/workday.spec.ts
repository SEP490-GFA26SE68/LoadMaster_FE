import type { Page } from '@playwright/test'
import { DEMO_EMAILS, DEMO_PASSWORD, expect, test } from './fixtures'
import { loadingOrderOf, typeVerifyCode } from './operations-helpers'
import { addPackage, addStop, MOCK_DB, optimizeAndOpenPlanner, optimizeRoute, waitForOtherRevision } from './spec-flow-helpers'

/**
 * LM-101 — một ngày làm việc của 5 vai trò trên cùng một kho in-memory (đổi người bằng đăng xuất/đăng nhập trong app, không tải
 * lại trang): điều phối tạo chuyến, thêm kiện, tối ưu, duyệt (FE-0-07) → kho soạn rồi xếp có đối chiếu (bỏ lại 1 kiện hỏng, FE-6-02,
 * FE-6-05) → tài xế xuất phát, đến điểm, dỡ có đối chiếu (1 sự cố, FE-6-06) → quản lý
 * công ty thấy chuyến hoàn thành trên bảng điều khiển và xuất báo cáo → quản trị công ty đọc đủ chuỗi sự kiện của chuyến trong nhật ký
 * của công ty mình (FE-0-08).
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-015'
const NAMES = { dispatcher: 'Nguyễn Thanh Tùng', warehouse: 'Lê Văn Hải', driver: 'Phạm Quốc Dũng', companyManager: 'Trần Thị Mai' } as const

/** Hôm nay theo giờ Việt Nam — ngày chạy của chuyến, cùng mốc với seed và kỳ của bảng điều khiển. */
function vnToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function signIn(page: Page, role: keyof typeof DEMO_EMAILS) {
  await page.getByLabel('Email', { exact: true }).fill(DEMO_EMAILS[role])
  await page.getByLabel('Mật khẩu', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.waitForURL((url) => url.pathname !== '/dang-nhap')
}

/** Đăng xuất bằng menu tài khoản (nav rail hoặc nút tài khoản ở màn chính của kho/tài xế). */
async function signOut(page: Page, name: string) {
  await page.getByRole('button', { name: `Tài khoản ${name}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click()
  await page.waitForURL(/\/dang-nhap$/)
}

test('one working day: plan, load, deliver, report and audit a trip across the five roles', async ({ page, login, browserErrors }) => {
  test.setTimeout(5 * 60_000)

  // Điều phối: tạo chuyến chạy hôm nay cho tài xế demo, một điểm giao, 6 kiện
  await login('/chuyen/moi', 'dispatcher')
  await page.getByRole('textbox', { name: 'Tên chuyến', exact: true }).fill('Tuyến ngày làm việc E2E')
  await page.getByLabel('Ngày chạy', { exact: true }).fill(vnToday())
  await page.getByRole('combobox', { name: 'Tài xế', exact: true }).click()
  await page.getByRole('option', { name: NAMES.driver, exact: true }).click()
  await page.getByRole('combobox', { name: 'Xe', exact: true }).click()
  await page.getByRole('option', { name: 'Truck 6m', exact: true }).click()
  await page.getByRole('button', { name: 'Tạo chuyến', exact: true }).click()
  await page.waitForURL(new RegExp(`/chuyen/${TRIP}$`))
  // FE-4b-04: điểm giao thêm ở Chi tiết chuyến, không nhập lúc tạo
  await addStop(page, { name: 'Siêu thị Co.opmart Biên Hoà', phone: '0251 381 4420', place: 'kcn amata' })
  // FE-4b-09: tối ưu tuyến trước, chuyến Nháp thành Đã lập kế hoạch; phương án xếp hàng là dòng phụ
  await expect(page.locator('header').getByText('Nháp', { exact: true })).toBeVisible()
  await optimizeRoute(page)
  await expect(page.locator('header').getByText('Đã lập kế hoạch', { exact: true })).toBeVisible()
  await addPackage(page, { name: 'Thùng nước suối 24 chai', lengthCm: 50, widthCm: 35, heightCm: 25, weightKg: 13, quantity: 6 })
  await expect(page.getByRole('row', { name: /Thùng nước suối 24 chai PKG-\d+ · 50 × 35 × 25 cm 13 kg 6\b/ })).toBeVisible()

  await page.getByRole('link', { name: 'Chạy tối ưu', exact: true }).click()
  await optimizeAndOpenPlanner(page)
  const sourceRevision = new URL(page.url()).searchParams.get('revision')
  await expect(page.getByText('MOCK RESULT', { exact: true }).first()).toBeVisible()
  // FE-0-07: điều phối viên duyệt ngay phương án vừa tối ưu — không có dòng nào bảo chờ người khác duyệt
  await expect(page.locator('[data-planner-lock]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  await page.getByRole('dialog', { name: 'Duyệt phương án này?' }).getByRole('button', { name: 'Duyệt', exact: true }).click()
  await waitForOtherRevision(page, sourceRevision)
  await page.getByRole('link', { name: 'Quay lại chuyến', exact: true }).click()
  await expect(page.locator('header').getByText('Đã lập kế hoạch', { exact: true })).toBeVisible()
  await expect(page.locator('header').getByText('Đã duyệt', { exact: true })).toBeVisible()
  await signOut(page, NAMES.dispatcher)

  // Kho: soạn đủ 6 kiện (không cần thứ tự), xếp 5 kiện theo thứ tự xếp — mỗi kiện đối chiếu bằng mã —, kiện cuối hỏng bị bỏ lại
  await signIn(page, 'warehouse')
  await page.waitForURL(/\/kho$/)
  const card = page.getByRole('list', { name: 'Chờ soạn', exact: true }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: TRIP, exact: true }) })
  await card.getByRole('link', { name: 'Bắt đầu soạn hàng', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Kiện chưa soạn (6)', exact: true })).toBeVisible()
  const order = await loadingOrderOf(page, TRIP)
  expect(order).toHaveLength(6)
  await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
  const staging = page.getByRole('dialog', { name: 'Đối chiếu kiện vào khu chờ' })
  for (const [index, id] of order.toReversed().entries()) {
    await typeVerifyCode(staging, id)
    // Hộp ở lại để soạn kiện kế tiếp, tự đóng khi soạn xong kiện cuối
    if (index < 5) await expect(staging.getByText(new RegExp(`^Đã soạn ${id} · `))).toBeVisible()
  }
  await expect(staging).toBeHidden()
  await expect(page.getByText('Bước 1 / 6', { exact: true })).toBeVisible()
  for (let step = 1; step <= 5; step += 1) {
    await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
    await typeVerifyCode(page.getByRole('dialog', { name: `Đối chiếu kiện bước ${step}` }), order[step - 1] ?? '')
    await expect(page.getByText(`Bước ${step + 1} / 6`, { exact: true })).toBeVisible()
  }
  // Kiện xếp cuối cùng không có kiện nào tựa lên trong phương án: bỏ lại kho, xếp xong
  await page.getByRole('button', { name: 'Kiện hỏng', exact: true }).click()
  const damaged = page.getByRole('dialog', { name: `Ghi ${order[5]} là kiện hỏng?` })
  await expect(damaged).toContainText('Trong phương án không kiện nào tựa lên nó')
  await damaged.getByRole('button', { name: 'Ghi kiện hỏng', exact: true }).click()
  // Kiện cuối có kết quả thì màn tự hoàn tất xếp (nút "Hoàn tất xếp hàng" chỉ hiện khi mở lại một phiên đã ghi đủ)
  await expect(page.getByText(`Đã xếp xong chuyến ${TRIP}`, { exact: true })).toBeVisible()
  await expect(page.getByText('Đã xếp 5 / 6 kiện', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về danh sách chuyến', exact: true }).click()
  await signOut(page, NAMES.warehouse)

  // Tài xế: xuất phát, đến điểm, báo một kiện hỏng, dỡ 5 kiện có trên xe bằng đối chiếu, hoàn tất → tổng kết
  await signIn(page, 'driver')
  await page.waitForURL(/\/tai-xe$/)
  await page.getByRole('region', { name: 'Xếp xong — chờ xuất phát' }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: TRIP, exact: true }) })
    .getByRole('link', { name: 'Mở chuyến', exact: true }).click()
  await page.getByRole('button', { name: 'Xuất phát', exact: true }).click()
  await page.getByRole('button', { name: 'Đã đến điểm 1', exact: true }).click()
  // Kiện có trên xe của điểm 1: kiện của phương án kho đã xếp, trừ kiện hỏng bị bỏ lại kho
  const onTruck = await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb, stopItemIds } = (await import(db)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(tripId)
    return stopItemIds(trip, await getMockDb().getRevision(trip.loading?.revisionId ?? ''), 1)
  }, { db: MOCK_DB, tripId: TRIP })
  expect(onTruck).toHaveLength(5)
  await page.getByRole('button', { name: 'Báo sự cố', exact: true }).click()
  const issue = page.getByRole('dialog', { name: 'Báo sự cố tại điểm 1' })
  await issue.getByText('Hàng hỏng', { exact: true }).click()
  await issue.getByRole('textbox', { name: 'Ghi chú', exact: true }).fill('Móp một góc, khách vẫn nhận')
  await issue.getByRole('button', { name: 'Ghi sự cố', exact: true }).click()
  await expect(issue).toBeHidden()
  // Kiện móp khách vẫn nhận: vẫn dỡ bằng đối chiếu như các kiện khác
  await page.getByRole('button', { name: 'Đối chiếu kiện dỡ', exact: true }).click()
  const unloading = page.getByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 1' })
  for (const id of onTruck) {
    await typeVerifyCode(unloading, id)
    await expect(page.locator(`li[data-package-id="${id}"]`)).toHaveAttribute('data-state', 'unloaded')
  }
  await expect(unloading).toBeHidden()
  await expect(page.getByText('Mọi kiện của điểm này đã dỡ hoặc đã báo sự cố.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hoàn tất điểm giao', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Tổng kết chuyến', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sự cố', exact: true })).toContainText('Hàng hỏng')
  await page.getByRole('link', { name: /Về danh sách|Chuyến của tôi/ }).first().click()
  await page.waitForURL(/\/tai-xe$/)
  await signOut(page, NAMES.driver)

  // Quản lý: chuyến hoàn thành nằm trong kỳ 7 ngày, xuất báo cáo
  await signIn(page, 'companyManager')
  await page.waitForURL((url) => url.pathname === '/')
  await page.getByRole('button', { name: '7 ngày', exact: true }).click()
  await expect(page.getByRole('link', { name: new RegExp(TRIP) }).first()).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất báo cáo', exact: true }).click()])
  expect(download.suggestedFilename()).toMatch(/^bao-cao-van-hanh_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx$/)
  // Đọc kho ngay dưới phiên của quản lý công ty: kho lọc theo công ty của phiên và từ chối tài khoản nền tảng đọc chuyến (FE-0-02)
  const store = await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb, tripStatus } = (await import(db)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(tripId)
    return { status: tripStatus(trip), issues: trip.delivery?.issues.map((item) => item.kind) }
  }, { db: MOCK_DB, tripId: TRIP })
  expect(store).toStrictEqual({ status: 'DELIVERED', issues: ['damaged'] })
  await signOut(page, NAMES.companyManager)

  // Quản trị công ty: nhật ký của công ty có đủ chuỗi việc của chuyến, đúng người làm
  await signIn(page, 'companyAdmin')
  await page.getByRole('link', { name: 'Nhật ký', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Tìm theo mã chuyến, xe, người dùng', exact: true }).fill(TRIP)
  const log = page.locator('tbody')
  for (const [action, actor] of [
    ['Tạo chuyến', NAMES.dispatcher],
    ['Lưu kết quả tối ưu', NAMES.dispatcher],
    ['Duyệt phương án', NAMES.dispatcher],
    ['Bắt đầu soạn hàng', NAMES.warehouse],
    ['Kho báo kiện hỏng khi xếp', NAMES.warehouse],
    ['Xếp xong', NAMES.warehouse],
    ['Xuất phát giao hàng', NAMES.driver],
    ['Tài xế đã đến điểm giao', NAMES.driver],
    ['Báo sự cố giao hàng', NAMES.driver],
    ['Hoàn tất điểm giao', NAMES.driver],
    ['Hoàn thành chuyến', NAMES.driver],
  ] as const) {
    await expect(log.getByRole('row').filter({ hasText: action }).first(), action).toContainText(actor)
  }
  expect(browserErrors).toStrictEqual([])
})
