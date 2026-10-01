import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { navigateInApp, switchUser } from './spec-flow-helpers'
import { closeInspector, openInspector } from './viewer-helpers'

/**
 * Planner đọc revision thật và Duyệt (LM-049, LM-050): chỉ số, Duyệt tạo revision approved mới, kết quả lỗi thời chặn Duyệt.
 * LM-094: bản seed đã duyệt (REV-002) không có nút Duyệt — Duyệt đi từ revision nguồn chưa duyệt `REV-001`.
 * Kho sửa trong trình duyệt qua đúng module app đang dùng; chuyển route phía client để không mất kho trong bộ nhớ.
 */
const TRIP_ID = 'TRIP-2026-0914'
const PLANNER = `/chuyen/${TRIP_ID}/phuong-an`
const SOURCE_REVISION = `${PLANNER}?revision=REV-001`
const MOCK_DB = '/src/lib/mock-db/index.ts'
/** "Duyệt bởi <tên> lúc HH:mm dd/MM" (LM-104): quản lý công ty demo là Trần Thị Mai. */
const APPROVED_BY_MANAGER = /Duyệt bởi Trần Thị Mai lúc\s*\d{2}:\d{2} \d{2}\/\d{2}/

function revisionCount(page: Page) {
  return page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    return (await getMockDb().listRevisions(tripId)).length
  }, { url: MOCK_DB, tripId: TRIP_ID })
}

test('approving the seed source revision creates a new approved revision and reopens it', async ({ page, login, browserErrors }) => {
  // LM-104: quản lý công ty duyệt
  await login(PLANNER, 'manager')
  await page.locator('canvas').waitFor()
  const header = page.locator('header').first()
  await expect(header).toContainText('MOCK RESULT')
  // LM-104: người duyệt do kho ghi vào revision đã duyệt (`approvedBy`), kể cả bản seed
  await expect(header).toContainText(APPROVED_BY_MANAGER)
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toHaveCount(0)

  // Tab Chỉ số: số lấy thẳng từ `result.metrics` của revision seed
  const inspector = await openInspector(page, 'metrics')
  await expect(inspector).toContainText('Chỉ số phương án')
  await expect(inspector).toContainText('Kiện đã xếp132')
  await closeInspector(page)

  await navigateInApp(page, SOURCE_REVISION)
  // V2.3 Planner3DBanChuaDuyet: bản chưa duyệt nói kho đang đọc bản nào và có lối mở bản đó
  const unapproved = page.locator('[data-planner-unapproved]')
  await expect(unapproved).toContainText('Đang xem REV-001 — kết quả tối ưu lúc')
  await expect(unapproved).toContainText('Kho và tài xế đang đọc bản đã duyệt REV-002')
  await expect(unapproved.getByRole('link', { name: 'Mở bản đã duyệt REV-002', exact: true })).toHaveAttribute('href', `${PLANNER}?revision=REV-002`)
  const before = await revisionCount(page)
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await expect(dialog).toContainText('Không có lỗi chặn duyệt')
  await expect(dialog).toContainText('Không có chỉnh tay.')
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click()
  await expect(page.getByText('Đã duyệt phương án.')).toBeVisible()
  await page.waitForURL(/\/phuong-an\?revision=REV-(?!001)/)
  expect(await revisionCount(page)).toBe(before + 1)
  await expect(header).toContainText(APPROVED_BY_MANAGER)
  expect(browserErrors).toStrictEqual([])
})

test('changing cargo after optimisation marks the plan stale and blocks approval', async ({ page, login }) => {
  // Sửa kho trước khi Planner đọc (Query giữ dữ liệu 30 s).
  // Hai vai trò (LM-104): điều phối viên sửa kiện và được dẫn tới Thiết lập tối ưu; quản lý công ty là người bị chặn Duyệt.
  await login('/doi-xe', 'dispatcher')
  await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const trip = await db.getTrip(tripId)
    await db.updateTrip(tripId, { packages: trip.packages.map((pkg, i) => i === 0 ? { ...pkg, weightKg: pkg.weightKg + 1 } : pkg) })
  }, { url: MOCK_DB, tripId: TRIP_ID })
  await navigateInApp(page, PLANNER)

  const stale = page.getByRole('alert').filter({ hasText: 'Kết quả đã lỗi thời' })
  await expect(stale).toBeVisible()
  // V2.3 Planner3DLoiThoi: thanh nói lần sửa nào làm lỗi thời (trường, trước → sau) và ai phải duyệt lại
  await expect(stale).toContainText(/Sau lần tối ưu \d{2}:\d{2} · \d{2}\/\d{2}: PKG-\S+ .+ · Khối lượng /)
  await expect(stale).toContainText('Kho chỉ xếp được khi quản lý công ty duyệt lại.')
  await expect(page.getByRole('link', { name: 'Tới Thiết lập tối ưu' })).toHaveAttribute('href', `/chuyen/${TRIP_ID}/toi-uu`)

  // Quản lý công ty đăng nhập ngay trong app (tải lại là mất lần sửa kiện): cùng thanh lỗi thời, không có lối sang Thiết lập tối ưu
  await switchUser(page, 'manager')
  await navigateInApp(page, PLANNER)
  await expect(stale).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tới Thiết lập tối ưu' })).toHaveCount(0)
  // Bản đã duyệt không có nút Duyệt (LM-094); revision nguồn chưa duyệt thì có, kèm lý do chặn trong nút và hộp thoại
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toHaveCount(0)
  await navigateInApp(page, SOURCE_REVISION)
  const approve = page.getByRole('button', { name: 'Duyệt phương án', exact: true })
  await expect(approve).toHaveAccessibleDescription('Chưa duyệt được: kết quả lỗi thời.')
  // U-5: lý do không còn là chữ đỏ chen trong thanh trên mà nằm ở tooltip của nút
  await expect(page.locator('header').first().locator('.text-badge-danger-fg')).toHaveCount(0)
  await approve.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Chưa duyệt được: kết quả lỗi thời.')
  await approve.click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await expect(dialog).toContainText('Kết quả lỗi thời — chạy tối ưu lại trước khi duyệt.')
  await expect(dialog.getByRole('button', { name: 'Duyệt', exact: true })).toBeDisabled()
})
