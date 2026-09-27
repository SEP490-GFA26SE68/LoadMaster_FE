import type { Page } from '@playwright/test'
import { attachScreenshot, DEMO_EMAILS, DEMO_PASSWORD, expect, test } from './fixtures'
import { navigateInApp, optimizeAndOpenPlanner } from './spec-flow-helpers'

/**
 * Luồng 3 + 4 Review 1 (LM-104) trên cùng một kho in-memory (đổi người bằng đăng xuất/đăng nhập, không tải lại trang): điều phối chạy
 * tối ưu với mục tiêu + thuật toán và thấy lần chạy trong lịch sử → quản lý công ty thấy phương án ở "Chờ duyệt", từ chối kèm lý do →
 * điều phối đọc lý do ở Planner và Thiết lập tối ưu → quản lý duyệt phương án còn lại, Planner ghi "Duyệt bởi … lúc …".
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-2026-0914'
const SETUP = `/chuyen/${TRIP}/toi-uu`
const NAMES = { dispatcher: 'Nguyễn Thanh Tùng', manager: 'Trần Thị Mai' } as const
const REASON = 'Hàng dồn về phía sau, cần cân bằng lại tải trục'

async function signIn(page: Page, role: keyof typeof NAMES) {
  await page.getByLabel('Email', { exact: true }).fill(DEMO_EMAILS[role])
  await page.getByLabel('Mật khẩu', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.waitForURL((url) => url.pathname !== '/dang-nhap')
}

async function signOut(page: Page, role: keyof typeof NAMES) {
  await page.getByRole('button', { name: `Tài khoản ${NAMES[role]}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click()
  await page.waitForURL(/\/dang-nhap$/)
}

/** Dòng mới nhất của bảng "Lần chạy tối ưu" (dòng 0 là tiêu đề). */
const newestRun = (page: Page) => page.locator('[data-run-history]').getByRole('row').nth(1)

test('dispatcher optimizes with an objective and algorithm; the company manager rejects it with a reason, then approves another plan', async ({ page, login, browserErrors }, testInfo) => {
  test.setTimeout(4 * 60_000)

  // Điều phối: chọn mục tiêu + thuật toán trong thiết lập nâng cao, chạy tối ưu
  await login(SETUP, 'dispatcher')
  await page.locator('summary').filter({ hasText: 'Thiết lập nâng cao' }).click()
  await page.getByRole('radio', { name: 'Cân bằng tải trục', exact: true }).click()
  await page.getByRole('radio', { name: 'Di truyền (GA)', exact: true }).click()
  await optimizeAndOpenPlanner(page)
  await expect(page.locator('[data-planner-lock="awaitingApproval"]')).toBeVisible()
  const plannerRoute = new URL(page.url()).pathname + new URL(page.url()).search

  // Lịch sử lần chạy: lần mới nhất đứng đầu, mang đúng lựa chọn và đang chờ duyệt
  await navigateInApp(page, SETUP)
  await expect(newestRun(page)).toContainText('Cân bằng tải trục')
  await expect(newestRun(page)).toContainText('Di truyền (GA)')
  await expect(newestRun(page)).toContainText(NAMES.dispatcher)
  await expect(newestRun(page)).toContainText('Có kết quả')
  await expect(newestRun(page)).toContainText('Chờ duyệt')
  await expect(page.locator('[data-run-history]').getByRole('row')).toHaveCount(4)
  await attachScreenshot(page, testInfo, 'luong-3-lich-su-lan-chay')
  await signOut(page, 'dispatcher')

  // Quản lý công ty: phương án ở hàng đợi chờ duyệt, từ chối kèm lý do (lý do bắt buộc)
  await signIn(page, 'manager')
  await navigateInApp(page, '/duyet')
  const card = page.locator(`[data-review-trip="${TRIP}"]`)
  await expect(card).toContainText('Cân bằng tải trục · Di truyền (GA)')
  await expect(card).toContainText(`Chạy bởi ${NAMES.dispatcher}`)
  await card.getByRole('link', { name: `Xem và duyệt phương án của ${TRIP}`, exact: true }).click()
  await page.locator('canvas').waitFor()
  await page.getByRole('button', { name: 'Quyết định khác', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Từ chối', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Từ chối phương án?' })
  await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click()
  await expect(dialog.getByText('Nhập lý do.', { exact: true })).toBeVisible()
  await dialog.getByLabel('Lý do', { exact: true }).fill(REASON)
  await dialog.getByRole('button', { name: 'Từ chối', exact: true }).click()
  await expect(dialog).toBeHidden()
  const notice = page.locator('[data-plan-decision="rejected"]')
  await expect(notice).toContainText(`Lý do: ${REASON}`)
  await expect(notice).toContainText(NAMES.manager)
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toHaveCount(0)

  await navigateInApp(page, '/duyet')
  await expect(page.locator(`[data-review-trip="${TRIP}"]`)).toHaveCount(0)
  await expect(page.locator('[data-recent-decisions]')).toContainText(REASON)
  await signOut(page, 'manager')

  // Điều phối: đọc lý do ở Planner và ở Thiết lập tối ưu, lần chạy mang nhãn "Bị từ chối"
  await signIn(page, 'dispatcher')
  await navigateInApp(page, plannerRoute)
  await expect(page.locator('[data-plan-decision="rejected"]')).toContainText(`Lý do: ${REASON}`)
  await expect(page.locator('[data-plan-decision="rejected"]').getByRole('link', { name: 'Tới Thiết lập tối ưu', exact: true })).toBeVisible()
  await navigateInApp(page, SETUP)
  await expect(page.locator('[data-open-decision="rejected"]')).toContainText(REASON)
  await expect(newestRun(page)).toContainText('Bị từ chối')
  await signOut(page, 'dispatcher')

  // Quản lý công ty: duyệt phương án còn lại trong hàng đợi (TRIP-012)
  await signIn(page, 'manager')
  await navigateInApp(page, '/duyet')
  await page.getByRole('link', { name: 'Xem và duyệt phương án của TRIP-012', exact: true }).click()
  await page.locator('canvas').waitFor()
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  await page.getByRole('dialog', { name: 'Duyệt phương án này?' }).getByRole('button', { name: 'Duyệt', exact: true }).click()
  await page.waitForURL(/\/chuyen\/TRIP-012\/phuong-an\?revision=REV-/)
  await expect(page.locator('header').first()).toContainText(/Duyệt bởi Trần Thị Mai lúc\s*\d{2}:\d{2} \d{2}\/\d{2}/)
  await navigateInApp(page, '/duyet')
  await expect(page.getByText('Không có phương án nào chờ duyệt.', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
