import type { Page } from '@playwright/test'
import { DEMO_EMAILS, DEMO_PASSWORD, expect, test } from './fixtures'
import { addPackage, MOCK_DB, optimizeAndOpenPlanner } from './spec-flow-helpers'

/**
 * LM-101 — một ngày làm việc của 5 vai trò trên cùng một kho in-memory (đổi người bằng đăng xuất/đăng nhập trong app, không tải
 * lại trang): điều phối tạo chuyến, thêm kiện, tối ưu, duyệt (FE-0-07) → kho xếp (báo thiếu 1) → tài xế giao (1 sự cố) → quản lý
 * công ty thấy chuyến hoàn thành trên bảng điều khiển và xuất báo cáo → quản trị công ty đọc đủ chuỗi sự kiện của chuyến trong nhật ký
 * của công ty mình (FE-0-08).
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-015'
const NAMES = { dispatcher: 'Nguyễn Thanh Tùng', warehouse: 'Lê Văn Hải', driver: 'Phạm Quốc Dũng', manager: 'Trần Thị Mai' } as const

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
  await page.getByRole('textbox', { name: 'Tên điểm giao 1', exact: true }).fill('Siêu thị Co.opmart Biên Hoà')
  await page.getByRole('textbox', { name: 'Số điện thoại điểm giao 1', exact: true }).fill('0251 381 4420')
  await page.getByRole('button', { name: 'Tạo chuyến', exact: true }).click()
  await page.waitForURL(new RegExp(`/chuyen/${TRIP}$`))
  await addPackage(page, { name: 'Thùng nước suối 24 chai', lengthCm: 50, widthCm: 35, heightCm: 25, weightKg: 13, quantity: 6 })
  await expect(page.getByRole('row', { name: /Thùng nước suối 24 chai PKG-\d+ · 50 × 35 × 25 cm 13 kg 6\b/ })).toBeVisible()

  await page.getByRole('link', { name: 'Chạy tối ưu', exact: true }).click()
  await optimizeAndOpenPlanner(page)
  await expect(page.getByText('MOCK RESULT', { exact: true }).first()).toBeVisible()
  // FE-0-07: điều phối viên duyệt ngay phương án vừa tối ưu — không có dòng nào bảo chờ người khác duyệt
  await expect(page.locator('[data-planner-lock]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  await page.getByRole('dialog', { name: 'Duyệt phương án này?' }).getByRole('button', { name: 'Duyệt', exact: true }).click()
  await page.waitForURL(/\/phuong-an\?revision=REV-/)
  await page.getByRole('link', { name: 'Quay lại chuyến', exact: true }).click()
  await expect(page.locator('header').getByText('Đã lập kế hoạch', { exact: true })).toBeVisible()
  await expect(page.locator('header').getByText('Đã duyệt', { exact: true })).toBeVisible()
  await signOut(page, NAMES.dispatcher)

  // Kho: xếp 5 kiện, báo thiếu 1, hoàn tất
  await signIn(page, 'warehouse')
  await page.waitForURL(/\/kho$/)
  const card = page.getByRole('list', { name: 'Chuyến cần xếp', exact: true }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: TRIP, exact: true }) })
  await card.getByRole('link', { name: 'Bắt đầu xếp', exact: true }).click()
  await expect(page.getByText('Bước 1 / 6', { exact: true })).toBeVisible()
  for (let step = 1; step <= 6; step += 1) {
    if (step === 3) {
      await page.getByRole('button', { name: 'Kiện này không có ở kho', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Ghi thiếu', exact: true }).click()
    } else {
      await page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true }).click()
    }
    if (step < 6) await expect(page.getByText(`Bước ${step + 1} / 6`, { exact: true })).toBeVisible()
  }
  // Kiện cuối có kết quả thì màn tự hoàn tất xếp (nút "Hoàn tất xếp hàng" chỉ hiện khi mở lại một phiên đã ghi đủ)
  await expect(page.getByText(`Đã xếp xong chuyến ${TRIP}`, { exact: true })).toBeVisible()
  await expect(page.getByText('Đã xếp 5 / 6 kiện', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về danh sách chuyến', exact: true }).click()
  await signOut(page, NAMES.warehouse)

  // Tài xế: bắt đầu giao, dỡ 5 kiện có trên xe, báo một kiện hỏng, hoàn tất → tổng kết
  await signIn(page, 'driver')
  await page.waitForURL(/\/tai-xe$/)
  await page.getByRole('region', { name: 'Sẵn sàng giao' }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: TRIP, exact: true }) })
    .getByRole('link', { name: 'Mở chuyến', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt đầu giao', exact: true }).click()
  // Kiện có trên xe của điểm 1: kiện của phương án kho đã xếp, trừ kiện kho báo thiếu
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
  for (const id of onTruck) {
    const mark = page.getByRole('button', { name: `Đánh dấu đã dỡ ${id}`, exact: true })
    if ((await mark.count()) === 0) continue
    await mark.click()
    await expect(page.getByRole('button', { name: `Bỏ đánh dấu đã dỡ ${id}`, exact: true })).toBeVisible()
  }
  await expect(page.getByText('Mọi kiện của điểm này đã dỡ hoặc đã báo sự cố.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hoàn tất điểm giao', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Tổng kết chuyến', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sự cố', exact: true })).toContainText('Hàng hỏng')
  await page.getByRole('link', { name: /Về danh sách|Chuyến của tôi/ }).first().click()
  await page.waitForURL(/\/tai-xe$/)
  await signOut(page, NAMES.driver)

  // Quản lý: chuyến hoàn thành nằm trong kỳ 7 ngày, xuất báo cáo
  await signIn(page, 'manager')
  await page.waitForURL((url) => url.pathname === '/')
  await page.getByRole('button', { name: '7 ngày', exact: true }).click()
  await expect(page.getByRole('link', { name: new RegExp(TRIP) }).first()).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất báo cáo', exact: true }).click()])
  expect(download.suggestedFilename()).toMatch(/^bao-cao-van-hanh_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.xlsx$/)
  // Đọc kho ngay dưới phiên của quản lý công ty: kho lọc theo công ty của phiên và từ chối tài khoản nền tảng đọc chuyến (FE-0-02)
  const store = await page.evaluate(async ({ db, tripId }) => {
    const { getMockDb, tripStatus } = (await import(db)) as typeof import('@/lib/mock-db')
    const trip = await getMockDb().getTrip(tripId)
    return { status: tripStatus(trip, await getMockDb().listRevisions(tripId)), issues: trip.delivery?.issues.map((item) => item.kind) }
  }, { db: MOCK_DB, tripId: TRIP })
  expect(store).toStrictEqual({ status: 'DELIVERED', issues: ['damaged'] })
  await signOut(page, NAMES.manager)

  // Quản trị công ty: nhật ký của công ty có đủ chuỗi việc của chuyến, đúng người làm
  await signIn(page, 'companyAdmin')
  await page.getByRole('link', { name: 'Nhật ký', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Tìm theo mã chuyến, xe, người dùng', exact: true }).fill(TRIP)
  const log = page.locator('tbody')
  for (const [action, actor] of [
    ['Tạo chuyến', NAMES.dispatcher],
    ['Lưu kết quả tối ưu', NAMES.dispatcher],
    ['Duyệt phương án', NAMES.dispatcher],
    ['Bắt đầu xếp hàng', NAMES.warehouse],
    ['Báo thiếu kiện ở kho', NAMES.warehouse],
    ['Xếp xong', NAMES.warehouse],
    ['Xuất phát giao hàng', NAMES.driver],
    ['Báo sự cố giao hàng', NAMES.driver],
    ['Hoàn tất điểm giao', NAMES.driver],
    ['Hoàn thành chuyến', NAMES.driver],
  ] as const) {
    await expect(log.getByRole('row').filter({ hasText: action }).first(), action).toContainText(actor)
  }
  expect(browserErrors).toStrictEqual([])
})
