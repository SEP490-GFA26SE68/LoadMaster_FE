import type { Page } from '@playwright/test'
import { attachScreenshot, expect, test } from './fixtures'
import { navigateInApp, optimizeAndOpenPlanner, switchUser } from './spec-flow-helpers'

/**
 * Luồng 3 + 4 Review 1 (LM-104) trên cùng một kho in-memory (đổi người ngay trong app, không tải lại trang): điều phối chạy tối ưu với
 * mục tiêu + thuật toán và thấy lần chạy trong lịch sử, phương án chờ duyệt → quản lý công ty mở phương án đó trong Planner và duyệt,
 * Planner ghi "Duyệt bởi … lúc …". FE-0-07: hàng đợi `/duyet` và các quyết định trả lại của quản lý đã bỏ.
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-2026-0914'
const SETUP = `/chuyen/${TRIP}/toi-uu`
const NAMES = { dispatcher: 'Nguyễn Thanh Tùng', manager: 'Trần Thị Mai' } as const

/** Dòng mới nhất của bảng "Lần chạy tối ưu" (dòng 0 là tiêu đề). */
const newestRun = (page: Page) => page.locator('[data-run-history]').getByRole('row').nth(1)

test('dispatcher optimizes with an objective and algorithm and sees the run awaiting approval; the company manager approves it in the Planner', async ({ page, login, browserErrors }, testInfo) => {
  test.setTimeout(4 * 60_000)

  // Điều phối: chọn mục tiêu + thuật toán trong thiết lập nâng cao, chạy tối ưu
  await login(SETUP, 'dispatcher')
  await page.locator('summary').filter({ hasText: 'Thiết lập nâng cao' }).click()
  await page.getByRole('radio', { name: 'Cân bằng tải trục', exact: true }).click()
  await page.getByRole('radio', { name: 'Di truyền (GA)', exact: true }).click()
  await optimizeAndOpenPlanner(page)
  await expect(page.locator('[data-planner-lock="awaitingApproval"]')).toBeVisible()
  const plannerRoute = new URL(page.url()).pathname + new URL(page.url()).search

  // Lịch sử lần chạy: lần mới nhất đứng đầu, mang đúng lựa chọn và đang chờ duyệt; lần ra bản đã duyệt của seed vẫn "Đã duyệt"
  await navigateInApp(page, SETUP)
  await expect(newestRun(page)).toContainText('Cân bằng tải trục')
  await expect(newestRun(page)).toContainText('Di truyền (GA)')
  await expect(newestRun(page)).toContainText(NAMES.dispatcher)
  await expect(newestRun(page)).toContainText('Có kết quả')
  await expect(newestRun(page)).toContainText('Chờ duyệt')
  await expect(page.locator('[data-run-history]').getByRole('row')).toHaveCount(4)
  await expect(page.locator('[data-run-history]').getByRole('row').nth(2)).toContainText('Đã duyệt')
  await attachScreenshot(page, testInfo, 'luong-3-lich-su-lan-chay')

  // Quản lý công ty: mở đúng phương án vừa tối ưu và duyệt
  await switchUser(page, 'manager')
  await navigateInApp(page, plannerRoute)
  await page.locator('canvas').waitFor()
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  await page.getByRole('dialog', { name: 'Duyệt phương án này?' }).getByRole('button', { name: 'Duyệt', exact: true }).click()
  await page.waitForURL(new RegExp(`/chuyen/${TRIP}/phuong-an\\?revision=REV-`))
  await expect(page.locator('header').first()).toContainText(new RegExp(`Duyệt bởi ${NAMES.manager} lúc\\s*\\d{2}:\\d{2} \\d{2}/\\d{2}`))

  // Hàng đợi duyệt đã bỏ: đường dẫn cũ là màn 404
  await navigateInApp(page, '/duyet')
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
