import type { Page } from '@playwright/test'
import { DEMO_EMAILS, DEMO_PASSWORD, expect, test } from './fixtures'

/**
 * LM-104 — luồng 1 phía logistics và luồng 2 trên cùng một kho in-memory (đổi người bằng đăng xuất / đăng nhập trong app, không tải
 * lại trang): công ty logistics quét QR nhận một kiện của lô SHP-002 đang nhận dở → điều phối tạo đơn từ kiện đã nhận, gán đơn vào
 * điểm giao của chuyến nháp TRIP-014 → Chi tiết chuyến có đơn và card "Kiểm tra trước khi tối ưu".
 */
test.use({ collectConsoleErrors: true })

async function switchUser(page: Page, from: string, to: keyof typeof DEMO_EMAILS) {
  await page.getByRole('button', { name: `Tài khoản ${from}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click()
  await page.waitForURL(/\/dang-nhap$/)
  await page.getByLabel('Email', { exact: true }).fill(DEMO_EMAILS[to])
  await page.getByLabel('Mật khẩu', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.waitForURL((url) => url.pathname !== '/dang-nhap')
}

test('logistics receives a package by QR, then the dispatcher orders it onto a stop of a planning trip', async ({ page, login, browserErrors }) => {
  // Logistics: màn chính là Nhận hàng; SHP-002 đang nhận 4 / 12
  await login('/', 'logistics')
  await expect(page).toHaveURL(/\/nhan-hang$/)
  const shipment = page.getByRole('region', { name: 'SHP-002', exact: true })
  await expect(shipment.getByRole('progressbar', { name: 'Đã nhận 4 / 12 kiện' })).toBeVisible()

  // Mã lạ: kho trả lỗi ngay trong hộp thoại quét
  await page.getByRole('button', { name: 'Quét QR nhận hàng', exact: true }).click()
  const scanner = page.getByRole('dialog', { name: 'Quét mã QR của kiện' })
  await scanner.getByRole('textbox', { name: 'Nhập mã', exact: true }).fill('lm 0000 0000 0000')
  await scanner.getByRole('button', { name: 'Xác nhận mã', exact: true }).click()
  await expect(scanner.getByRole('alert')).toHaveText('Mã LM-0000-0000-0000 không khớp kiện nào.')

  // Chọn kiện đang chờ → đối chiếu thông tin đăng ký → xác nhận nhận
  await scanner.getByRole('button', { name: /^RPK-0027 · Thùng sữa hộp 48 hộp/ }).click()
  const confirm = page.getByRole('dialog', { name: 'Nhận kiện RPK-0027' })
  await expect(confirm.getByText('60 × 40 × 40 cm', { exact: true })).toBeVisible()
  await expect(confirm.getByText('52 kg', { exact: true })).toBeVisible()
  await expect(confirm.getByText('SHP-002', { exact: true })).toBeVisible()
  await confirm.getByRole('button', { name: 'Xác nhận đã nhận', exact: true }).click()

  // Nhận xong: máy quét mở lại cho kiện kế tiếp; lô lên 5 / 12, kiện vào danh sách vừa nhận
  await expect(page.getByRole('dialog', { name: 'Quét mã QR của kiện' })).toContainText('Vừa nhận RPK-0027. Quét kiện tiếp theo.')
  await page.getByRole('dialog', { name: 'Quét mã QR của kiện' }).getByRole('button', { name: 'Đóng', exact: true }).last().click()
  await expect(shipment.getByRole('progressbar', { name: 'Đã nhận 5 / 12 kiện' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Vừa nhận', exact: true }).getByRole('listitem').first()).toContainText('RPK-0027')

  // Điều phối: tạo đơn từ 5 hộp sữa đã nhận
  await switchUser(page, 'Huỳnh Văn Phước', 'dispatcher')
  await page.getByRole('link', { name: 'Đơn hàng', exact: true }).click()
  await page.waitForURL(/\/don-hang$/)
  await page.getByRole('button', { name: 'Tạo đơn hàng', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Tạo đơn hàng' })
  await form.getByRole('textbox', { name: 'Khách hàng', exact: true }).fill('Điện máy Xanh Tân An')
  await form.getByRole('textbox', { name: 'Địa chỉ giao', exact: true }).fill('88 Hùng Vương, P. 2, Tân An, Long An')
  await form.getByRole('checkbox', { name: 'Chọn cả nhóm Thùng sữa hộp 48 hộp (5)', exact: true }).click()
  await expect(form.getByRole('status')).toHaveText('Đã chọn 5 kiện · 260 kg')
  await form.getByRole('button', { name: 'Tạo đơn', exact: true }).click()
  const row = page.getByRole('row', { name: /ORD-003/ })
  await expect(row).toContainText('Chờ gán chuyến')
  await expect(row).toContainText('260 kg')

  // Gán vào chuyến nháp TRIP-014: điểm giao trùng tên khách được chọn sẵn
  await row.getByRole('button', { name: 'Thao tác với đơn ORD-003', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Gán vào chuyến', exact: true }).click()
  const assign = page.getByRole('dialog', { name: 'Gán đơn ORD-003 vào chuyến' })
  await assign.getByRole('combobox', { name: 'Chuyến', exact: true }).click()
  await page.getByRole('option', { name: /^TRIP-014 · Tuyến Tân An – Dĩ An/ }).click()
  await expect(assign.getByRole('combobox', { name: 'Điểm giao', exact: true })).toHaveText('Điểm 1 · Điện máy Xanh Tân An')
  await assign.getByRole('button', { name: 'Gán vào chuyến', exact: true }).click()
  await expect(assign).toBeHidden()
  await expect(row).toContainText('Đã gán chuyến')
  await expect(row).toContainText('TRIP-014 · Điểm 1')

  // Chi tiết chuyến: đơn trên chuyến, dòng kiện mới ở điểm 1, kiểm tra trước tối ưu vẫn đạt
  await row.getByRole('link', { name: 'Tuyến Tân An – Dĩ An', exact: true }).click()
  await page.waitForURL(/\/chuyen\/TRIP-014$/)
  const orders = page.getByRole('region', { name: 'Đơn hàng trên chuyến', exact: true })
  await expect(orders).toContainText('ORD-003')
  await expect(orders).toContainText('Điểm 1 · Điện máy Xanh Tân An · 5 kiện')
  await expect(page.getByRole('region', { name: 'Kiện hàng' }).getByRole('row', { name: /Thùng sữa hộp 48 hộp/ })).toBeVisible()
  const readiness = page.getByRole('region', { name: 'Kiểm tra trước khi tối ưu', exact: true })
  await expect(readiness.getByText('Sẵn sàng tối ưu', { exact: true })).toBeVisible()
  await expect(readiness.getByText('145 kiện', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
