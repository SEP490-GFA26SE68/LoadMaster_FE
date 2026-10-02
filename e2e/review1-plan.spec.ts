import { expect, test } from './fixtures'

/**
 * LM-104 luồng 2 — đơn hàng trên kho in-memory của trang (không tải lại trang sau khi ghi): điều phối viên tạo đơn từ kiện đã ở kho,
 * gán đơn vào điểm giao của chuyến nháp TRIP-014 → Chi tiết chuyến có đơn và card "Kiểm tra trước khi tối ưu". FE-0-06 bỏ nửa đầu của
 * kịch bản (công ty logistics quét QR nhận kiện của lô hàng): không còn luồng nhận hàng, kiện "Đã nhận ở kho" do seed ghi thẳng.
 *
 * Số kỳ vọng chép tay từ seed (`seed-sourcing.ts`, `seed-directory.ts`, `seed-trips.ts`), không tính lại theo cách app tính:
 * - 18 kiện đã ở kho chưa vào đơn nào: 6 thùng sữa hộp (RPK-0023…0028), 6 thùng bánh quy, 6 kiện quạt điện;
 * - thùng sữa hộp 48 hộp nặng 52 kg → 6 thùng 312 kg;
 * - TRIP-014 có 40 kiện quạt + 40 nồi cơm điện + 60 thùng nước suối = 140 kiện, thêm 6 thùng sữa là 146.
 */
test.use({ collectConsoleErrors: true })

test('the dispatcher builds an order from packages in stock and assigns it onto a stop of a planning trip', async ({ page, login, browserErrors }) => {
  await login('/', 'dispatcher')
  await page.waitForURL(/\/chuyen$/)
  await page.getByRole('link', { name: 'Đơn hàng', exact: true }).click()
  await page.waitForURL(/\/don-hang$/)
  await expect(page.getByText('2 đơn chờ gán vào chuyến', { exact: true })).toBeVisible()

  // Tạo đơn từ 6 thùng sữa đã ở kho; ô chọn kiện nhóm theo loại, chỉ gồm kiện "Đã nhận ở kho" chưa vào đơn
  await page.getByRole('button', { name: 'Tạo đơn hàng', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Tạo đơn hàng' })
  await form.getByRole('textbox', { name: 'Khách hàng', exact: true }).fill('Điện máy Xanh Tân An')
  await form.getByRole('textbox', { name: 'Địa chỉ giao', exact: true }).fill('88 Hùng Vương, P. 2, Tân An, Long An')
  await expect(form.getByRole('checkbox', { name: /^Chọn cả nhóm / })).toHaveCount(3)
  await expect(form.getByRole('checkbox', { name: 'Chọn cả nhóm Thùng bánh quy (6)', exact: true })).toBeVisible()
  await expect(form.getByRole('checkbox', { name: 'Chọn cả nhóm Kiện quạt điện (6)', exact: true })).toBeVisible()
  // Thùng dầu ăn mới đăng ký (RPK-0035…), hàng chưa về kho: không có trong ô chọn
  await expect(form.getByText('RPK-0035', { exact: true })).toHaveCount(0)
  await form.getByRole('checkbox', { name: 'Chọn cả nhóm Thùng sữa hộp 48 hộp (6)', exact: true }).click()
  await expect(form.getByRole('status')).toHaveText('Đã chọn 6 kiện · 312 kg')
  await form.getByRole('button', { name: 'Tạo đơn', exact: true }).click()
  const row = page.getByRole('row', { name: /ORD-003/ })
  await expect(row).toContainText('Chờ gán chuyến')
  await expect(row).toContainText('312 kg')

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
  await expect(orders).toContainText('Điểm 1 · Điện máy Xanh Tân An · 6 kiện')
  await expect(page.getByRole('region', { name: 'Kiện hàng' }).getByRole('row', { name: /Thùng sữa hộp 48 hộp/ })).toBeVisible()
  const readiness = page.getByRole('region', { name: 'Kiểm tra trước khi tối ưu', exact: true })
  await expect(readiness.getByText('Sẵn sàng tối ưu', { exact: true })).toBeVisible()
  await expect(readiness.getByText('146 kiện', { exact: true })).toBeVisible()

  // Kiện của đơn đã gán sang "Đã lên kế hoạch" ở màn Kiện hàng của điều phối viên
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Kiện hàng', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  await page.getByRole('tab', { name: /^Đã lên kế hoạch/ }).click()
  await expect(page.getByRole('row', { name: /RPK-00/ })).toHaveCount(6)
  await expect(page.getByRole('row', { name: /RPK-0023/ })).toContainText('Đã lên kế hoạch')
  expect(browserErrors).toStrictEqual([])
})
