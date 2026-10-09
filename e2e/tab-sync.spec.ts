import { DEMO_EMAILS, expect, test } from './fixtures'
import { signInWith } from './spec-flow-helpers'

/**
 * Đồng bộ kho giữa các tab cùng trình duyệt (FE-BL-06): điều phối ở tab 1, nhân viên kho ở tab 2 — hai tab cùng một context nên cùng
 * một `BroadcastChannel`. Điều phối huỷ chuyến TRIP-011 mà kho đang xếp thì tab của kho thấy chuyến biến khỏi danh sách mà không tải lại;
 * tab mở sau cùng thấy chuyến đã huỷ. Mỗi tab giữ phiên riêng: không tab nào bị đăng xuất hay đổi người.
 */

test('a trip cancelled by the dispatcher in one tab disappears from the warehouse list in another tab without a reload; a tab opened later sees it cancelled', async ({ page, login, context, browserErrors }) => {
  // TRIP-011 (seed): kho đã soạn đủ và xếp 110 kiện, nên nằm ở danh sách "Đang xếp hàng" của /kho
  await login('/chuyen/TRIP-011', 'dispatcher')
  await expect(page.locator('header').getByText('Đang xếp hàng', { exact: true })).toBeVisible()

  const warehouse = await context.newPage()
  warehouse.on('pageerror', (error) => browserErrors.push(error.message))
  await warehouse.goto('/kho')
  await signInWith(warehouse, DEMO_EMAILS.warehouse)
  const onWarehouse = warehouse.getByRole('list', { name: 'Đang xếp hàng', exact: true }).getByRole('heading', { name: 'TRIP-011', exact: true })
  await expect(onWarehouse).toBeVisible()

  // Tab 1: điều phối huỷ chuyến
  await page.getByRole('button', { name: 'Thao tác', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Huỷ chuyến', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Huỷ chuyến TRIP-011?' })
  await dialog.getByLabel('Lý do huỷ', { exact: true }).fill('Xe hỏng máy lạnh')
  await dialog.getByRole('button', { name: 'Huỷ chuyến', exact: true }).click()
  await expect(page.locator('header').getByText('Đã huỷ', { exact: true })).toBeVisible()

  // Tab 2: không tải lại, chuyến không còn trong danh sách của kho; phiên của kho vẫn nguyên
  await expect(onWarehouse).toHaveCount(0, { timeout: 15_000 })
  await expect(warehouse.getByRole('button', { name: /^Tài khoản / })).toBeVisible()
  await expect(warehouse).toHaveURL(/\/kho$/)

  // Tab 3 mở sau: lấy trạng thái hiện tại của các tab đang mở, không dựng lại seed
  const manager = await context.newPage()
  manager.on('pageerror', (error) => browserErrors.push(error.message))
  await manager.goto('/chuyen/TRIP-011')
  await signInWith(manager, DEMO_EMAILS.manager)
  await expect(manager.locator('header').getByText('Đã huỷ', { exact: true })).toBeVisible({ timeout: 15_000 })

  // Tab 1 vẫn là điều phối viên: phiên không được đồng bộ
  await expect(page.getByRole('button', { name: /^Tài khoản Nguyễn Thanh Tùng/ })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
