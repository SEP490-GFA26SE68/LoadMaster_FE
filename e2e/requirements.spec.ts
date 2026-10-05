import { expect, test } from './fixtures'
import { switchUser } from './spec-flow-helpers'

/**
 * FE-4b-02 — yêu cầu giao trên kho in-memory của trang (không tải lại trang sau khi ghi; đổi người bằng `switchUser`): quản lý công ty
 * tạo yêu cầu từ kiện của kho kiện → điều phối viên chỉ xem, đưa yêu cầu vào chuyến nháp TRIP-014 (điểm giao tự gộp) → Chi tiết chuyến có
 * yêu cầu và card "Kiểm tra trước khi tối ưu" → kiện sang "Đã gán chuyến" ở Kho kiện. Thay kịch bản đơn hàng của LM-104 (luồng 2).
 *
 * Số kỳ vọng chép tay từ seed (`seed-sourcing.ts`, `seed-directory.ts`, `seed-trips.ts`), không tính lại theo cách app tính:
 * - sáu yêu cầu chờ xếp chuyến REQ-001…006 của Long Bình;
 * - 56 kiện chọn được (cùng 170 kiện của chuyến đã huỷ): 6 thùng sữa hộp (PK-0023…0028), 6 thùng bánh quy, 8 thùng dầu ăn, 6 kiện quạt
 *   điện và 30 kiện nhập file không gắn loại kiện, nhóm theo loại hàng (40 kiện trừ 8 kiện của REQ-001…004 và hai kiện mang cờ);
 * - thùng sữa hộp 48 hộp nặng 52 kg → 6 thùng 312 kg; điểm đến ghi trên sáu thùng sữa là KCN Sóng Thần 2;
 * - TRIP-014 có 40 kiện quạt + 40 nồi cơm điện + 60 thùng nước suối = 140 kiện, thêm 6 thùng sữa là 146.
 */
test.use({ collectConsoleErrors: true })

/** Hạn sau hôm nay ba ngày: ở tương lai theo đồng hồ của kho (giờ thật) ở mọi múi giờ. */
const dueDate = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

test('the manager creates a delivery requirement; the dispatcher only reads it and puts it on a stop of a planning trip', async ({ page, login, browserErrors }) => {
  // Đường dẫn cũ của màn Đơn hàng chuyển hướng sang màn mới (đọc trước khi ghi gì vào kho)
  await login('/don-hang', 'manager')
  await page.waitForURL(/\/yeu-cau-giao$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Yêu cầu giao', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Yêu cầu giao · LoadMaster')
  await expect(page.getByText('6 yêu cầu chờ xếp chuyến', { exact: true })).toBeVisible()
  // Sắp theo hạn gần nhất trước: REQ-006 (Bách Hoá Xanh Dĩ An) đứng đầu
  await expect(page.getByRole('row', { name: /REQ-/ }).first()).toContainText('REQ-006')

  // Tạo yêu cầu từ 6 thùng sữa; ô chọn kiện nhóm theo loại kiện (bốn nhóm), kiện không gắn loại theo loại hàng (năm nhóm)
  await page.getByRole('button', { name: 'Tạo yêu cầu giao', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Tạo yêu cầu giao' })
  await expect(form.getByRole('checkbox', { name: /^Chọn cả nhóm / })).toHaveCount(9)
  await expect(form.getByRole('checkbox', { name: 'Chọn cả nhóm Hàng Dễ vỡ (3)', exact: true })).toBeVisible()
  // Kiện mang cờ và kiện đã thuộc yêu cầu khác không có trong ô chọn: nhóm hàng nguy hiểm còn 4 kiện
  await expect(form.getByRole('checkbox', { name: 'Chọn cả nhóm Hàng Nguy hiểm (4)', exact: true })).toBeVisible()
  await expect(form.getByText('PK-0077', { exact: true })).toHaveCount(1)
  await expect(form.getByText('PK-0078', { exact: true })).toHaveCount(0)
  await expect(form.getByText('PK-0057', { exact: true })).toHaveCount(0)

  // Gửi khi còn thiếu: lỗi hiện tại ô, hộp thoại không đóng
  await form.getByRole('button', { name: 'Tạo yêu cầu', exact: true }).click()
  await expect(form.getByText('Nhập tên điểm đến.', { exact: true })).toBeVisible()
  await expect(form.getByText('Chọn ngày của hạn giao.', { exact: true })).toBeVisible()
  await expect(form.getByText('Chọn ít nhất một kiện.', { exact: true })).toBeVisible()

  await form.getByRole('textbox', { name: 'Tên điểm đến', exact: true }).fill('Điện máy Xanh Tân An')
  await form.getByRole('textbox', { name: 'Địa chỉ', exact: true }).fill('88 Hùng Vương, P. 2, Tân An, Long An')
  await form.getByLabel('Hạn giao').fill(dueDate())
  await form.getByRole('combobox', { name: 'Ưu tiên', exact: true }).click()
  await page.getByRole('option', { name: 'Cao', exact: true }).click()
  // Lọc ô chọn kiện theo điểm đến ghi trong file
  await form.getByRole('searchbox', { name: 'Lọc theo điểm đến ghi trong file, mã kiện', exact: true }).fill('song than 2')
  await expect(form.getByRole('checkbox', { name: /^Chọn cả nhóm / })).toHaveCount(1)
  await form.getByRole('checkbox', { name: 'Chọn cả nhóm Thùng sữa hộp 48 hộp (6)', exact: true }).click()
  await expect(form.getByRole('status').filter({ hasText: 'Đã chọn' })).toHaveText('Đã chọn 6 kiện · 312 kg')
  // Điểm đến ghi trong file khác điểm đến của yêu cầu: cảnh báo, vẫn lưu được
  await expect(form.getByText('Cần xem lại, vẫn lưu được', { exact: true })).toBeVisible()
  await expect(form.getByText(/^6 kiện có điểm đến ghi trong file khác điểm đến của yêu cầu: PK-0028/)).toBeVisible()
  await form.getByRole('button', { name: 'Tạo yêu cầu', exact: true }).click()
  await expect(form).toBeHidden()
  const row = page.getByRole('row', { name: /REQ-007/ })
  await expect(row).toContainText('Điện máy Xanh Tân An')
  await expect(row).toContainText('Chờ xếp chuyến')
  await expect(row).toContainText('Cao')
  await expect(row).toContainText('312 kg')
  await expect(page.getByText('7 yêu cầu chờ xếp chuyến', { exact: true })).toBeVisible()
  // Quản lý công ty không đưa yêu cầu vào chuyến: menu chỉ có xem, sửa, xoá
  await row.getByRole('button', { name: 'Thao tác với yêu cầu REQ-007', exact: true }).click()
  await expect(page.getByRole('menuitem')).toHaveText(['Xem chi tiết', 'Sửa yêu cầu', 'Xoá yêu cầu'])
  await page.keyboard.press('Escape')

  // Điều phối viên: cùng màn, chỉ xem — không nút tạo, menu không có sửa / xoá
  await switchUser(page, 'dispatcher')
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Yêu cầu giao', exact: true }).click()
  await page.waitForURL(/\/yeu-cau-giao$/)
  await expect(page.getByText('7 yêu cầu chờ xếp chuyến', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo yêu cầu giao', exact: true })).toHaveCount(0)
  await row.getByRole('button', { name: 'Xem chi tiết yêu cầu REQ-007', exact: true }).click()
  const detail = page.getByRole('dialog', { name: 'Yêu cầu REQ-007' })
  await expect(detail).toContainText('88 Hùng Vương, P. 2, Tân An, Long An')
  await expect(detail).toContainText('Chưa có toạ độ')
  await expect(detail).toContainText('Trần Thị Mai')
  await expect(detail.getByRole('table', { name: 'Kiện của yêu cầu' }).getByRole('row')).toHaveCount(7)
  await detail.getByRole('button', { name: 'Đóng', exact: true }).first().click()
  await expect(detail).toBeHidden()

  // Đưa vào chuyến nháp TRIP-014 (FE-4b-04): không chọn điểm giao — điểm 1 cùng địa chỉ, cũng chưa có toạ độ, nên yêu cầu gộp vào đó
  await row.getByRole('button', { name: 'Thao tác với yêu cầu REQ-007', exact: true }).click()
  await expect(page.getByRole('menuitem')).toHaveText(['Xem chi tiết', 'Đưa vào chuyến'])
  await page.getByRole('menuitem', { name: 'Đưa vào chuyến', exact: true }).click()
  const assign = page.getByRole('dialog', { name: 'Đưa yêu cầu REQ-007 vào chuyến' })
  await assign.getByRole('combobox', { name: 'Chuyến', exact: true }).click()
  await page.getByRole('option', { name: /^TRIP-014 · Tuyến Tân An – Dĩ An/ }).click()
  await expect(assign.getByRole('combobox', { name: 'Điểm giao', exact: true })).toHaveCount(0)
  await expect(assign.getByRole('status')).toContainText('Điểm giao: gộp vào điểm 1 · Điện máy Xanh Tân An — cùng địa chỉ và toạ độ.')
  await assign.getByRole('button', { name: 'Đưa vào chuyến', exact: true }).click()
  await expect(assign).toBeHidden()
  await expect(row).toContainText('Đã vào chuyến')
  await expect(row).toContainText('TRIP-014 · Điểm 1')
  await expect(page.getByText('6 yêu cầu chờ xếp chuyến', { exact: true })).toBeVisible()

  // Chi tiết chuyến: yêu cầu trên chuyến, dòng kiện mới ở điểm 1; kiểm tra trước tối ưu chỉ còn chờ tối ưu tuyến (chuyến nháp, FE-5b-05)
  await row.getByRole('link', { name: 'Tuyến Tân An – Dĩ An', exact: true }).click()
  await page.waitForURL(/\/chuyen\/TRIP-014$/)
  const onTrip = page.getByRole('region', { name: 'Yêu cầu giao của chuyến', exact: true })
  await expect(onTrip).toContainText('REQ-007')
  await expect(onTrip).toContainText('Điểm 1 · Điện máy Xanh Tân An · Hạn 17:00')
  await expect(onTrip).toContainText('6 kiện')
  // Không sinh điểm mới: chuyến vẫn hai điểm giao
  await expect(page.getByRole('region', { name: 'Sơ đồ tuyến' }).getByRole('button', { name: /^Lọc kiện theo điểm/ })).toHaveCount(2)
  await expect(page.getByRole('region', { name: 'Kiện hàng' }).getByRole('row', { name: /Thùng sữa hộp 48 hộp/ })).toBeVisible()
  const readiness = page.getByRole('region', { name: 'Kiểm tra trước khi tối ưu', exact: true })
  await expect(readiness.getByText('146 kiện', { exact: true })).toBeVisible()
  await expect(readiness.getByText('Chưa sẵn sàng tối ưu', { exact: true })).toBeVisible()
  await expect(readiness.getByText('Chưa tối ưu tuyến. Bấm "Tối ưu tuyến" ở sơ đồ tuyến để chốt thứ tự điểm giao', { exact: true })).toBeVisible()
  await expect(readiness.getByText('1 mục đang chặn tối ưu. Sửa xong rồi chạy tối ưu.', { exact: true })).toBeVisible()

  // Kiện của yêu cầu sang "Đã gán chuyến" ở màn Kho kiện của điều phối viên, kèm yêu cầu và chuyến đang giữ kiện
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Kho kiện', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  await page.getByRole('tab', { name: /^Đã gán chuyến/ }).click()
  await expect(page.getByRole('row', { name: /PK-00/ })).toHaveCount(6)
  const packageRow = page.getByRole('row', { name: /PK-0023/ })
  await expect(packageRow).toContainText('Đã gán chuyến')
  await expect(packageRow.getByRole('link', { name: 'REQ-007', exact: true })).toHaveAttribute('href', '/yeu-cau-giao?q=REQ-007')
  await expect(packageRow.getByRole('link', { name: 'TRIP-014', exact: true })).toHaveAttribute('href', '/chuyen/TRIP-014')
  expect(browserErrors).toStrictEqual([])
})
