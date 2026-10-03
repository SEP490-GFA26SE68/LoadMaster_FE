import type { Page } from '@playwright/test'
import { attachScreenshot, expect, test } from './fixtures'
import { navigateInApp, optimizeAndOpenPlanner, switchUser } from './spec-flow-helpers'

/**
 * Luồng tối ưu → so sánh → duyệt (LM-104; FE-0-07, D-80; FE-5b-05, FE-5b-06) trên cùng một kho in-memory, đổi người ngay trong app:
 * điều phối viên chạy tối ưu — một lần chạy ra ba phương án, không chọn mục tiêu hay thuật toán — thấy lần chạy "Chờ duyệt" trong lịch
 * sử, mở một phương án từ đó rồi **tự duyệt** trong Planner — Planner ghi "Duyệt bởi … lúc …", lần chạy thành "Đã duyệt" kèm nhãn
 * phương án. Quản lý công ty mở cùng phương án ở chế độ chỉ xem; hàng đợi `/duyet` không còn.
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-2026-0914'
const SETUP = `/chuyen/${TRIP}/toi-uu`
const DISPATCHER = 'Nguyễn Thanh Tùng'
const APPROVED_BY_DISPATCHER = new RegExp(`Duyệt bởi ${DISPATCHER} lúc\\s*\\d{2}:\\d{2} \\d{2}/\\d{2}`)

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
/** Dòng mới nhất của bảng "Lần chạy tối ưu" (dòng 0 là tiêu đề). */
const newestRun = (page: Page) => page.locator('[data-run-history]').getByRole('row').nth(1)

test('the dispatcher optimizes into three plans, approves one of them; the company manager reads it and has no approval queue', async ({ page, login, browserErrors }, testInfo) => {
  test.setTimeout(4 * 60_000)

  // Điều phối: không còn ô chọn mục tiêu hay thuật toán — thiết lập nâng cao chỉ nói tên thuật toán sẽ chạy
  await login(SETUP, 'dispatcher')
  await page.locator('summary').filter({ hasText: 'Thiết lập nâng cao' }).click()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.locator('[data-run-algorithm]')).toHaveText('EP + DBLF (mock)')
  await optimizeAndOpenPlanner(page, 'B')
  // Phương án mới chưa duyệt: điều phối viên có nút Duyệt, không có dòng nào bảo chờ người khác
  await expect(button(page, 'Duyệt phương án')).toBeVisible()
  await expect(page.locator('[data-planner-lock]')).toHaveCount(0)

  // Lịch sử lần chạy: lần mới nhất đứng đầu với ba phương án A · B · C, đang chờ duyệt; lần ra bản đã duyệt của seed vẫn "Đã duyệt"
  await navigateInApp(page, SETUP)
  await expect(newestRun(page)).toContainText('EP + DBLF (mock)')
  await expect(newestRun(page).getByRole('link', { name: /^Mở phương án REV-\d+ trong Planner$/ })).toHaveText([/^A · REV-\d+$/, /^B · REV-\d+$/, /^C · REV-\d+$/])
  await expect(newestRun(page)).toContainText(DISPATCHER)
  await expect(newestRun(page)).toContainText('Có kết quả')
  await expect(newestRun(page)).toContainText('Chờ duyệt')
  await expect(page.locator('[data-run-history]').getByRole('row')).toHaveCount(4)
  await expect(page.locator('[data-run-history]').getByRole('row').nth(2)).toContainText('Đã duyệt')
  await attachScreenshot(page, testInfo, 'luong-3-lich-su-lan-chay')

  // Điều phối viên tự duyệt phương án B vừa tối ưu: mở đúng bản đó từ lịch sử lần chạy, Duyệt tạo revision đã duyệt mới và mở nó
  await newestRun(page).getByRole('link', { name: /^Mở phương án REV-\d+ trong Planner$/ }).nth(1).click()
  await page.locator('canvas').waitFor()
  const sourceRevision = new URL(page.url()).searchParams.get('revision')
  expect(sourceRevision).toMatch(/^REV-\d+$/)
  await button(page, 'Duyệt phương án').click()
  await page.getByRole('dialog', { name: 'Duyệt phương án này?' }).getByRole('button', { name: 'Duyệt', exact: true }).click()
  await page.waitForURL(new RegExp(`/chuyen/${TRIP}/phuong-an\\?revision=REV-(?!${sourceRevision?.slice(4)}$)`))
  await expect(page.locator('header').first()).toContainText(APPROVED_BY_DISPATCHER)
  const approvedRoute = new URL(page.url()).pathname + new URL(page.url()).search
  await navigateInApp(page, SETUP)
  await expect(newestRun(page)).toContainText('Đã duyệt')
  await expect(newestRun(page)).toContainText('Phương án B')
  await expect(newestRun(page)).not.toContainText('Chờ duyệt')

  // Quản lý công ty: cùng phương án, chỉ xem — không Chỉnh sửa, không Duyệt, một dòng lý do; bản nguồn chưa duyệt cũng vậy
  await switchUser(page, 'manager')
  for (const route of [approvedRoute, `/chuyen/${TRIP}/phuong-an?revision=${sourceRevision}`]) {
    await navigateInApp(page, route)
    await page.locator('canvas').waitFor()
    await expect(page.locator('[data-planner-lock="readOnly"]'), route).toHaveText('Chỉ xem: chỉ điều phối viên chỉnh sửa và duyệt phương án.')
    for (const name of ['Chỉnh sửa', 'Duyệt phương án', 'Duyệt bản chỉnh']) await expect(button(page, name), `${route}: ${name}`).toHaveCount(0)
  }
  await navigateInApp(page, approvedRoute)
  await expect(page.locator('header').first()).toContainText(APPROVED_BY_DISPATCHER)

  // Hàng đợi duyệt đã bỏ: không còn mục điều hướng, đường dẫn cũ là màn 404
  await navigateInApp(page, '/')
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link')).toHaveText(['Bảng điều khiển', 'Yêu cầu giao', 'Kho kiện', 'Chuyến hàng', 'Đội xe'])
  await navigateInApp(page, '/duyet')
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
