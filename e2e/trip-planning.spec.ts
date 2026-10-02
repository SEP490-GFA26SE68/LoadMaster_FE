import { expect, test } from './fixtures'
import { switchUser } from './spec-flow-helpers'

/**
 * FE-4b-03 → FE-4b-05 — lập chuyến trên kho in-memory của trang (không tải lại trang sau khi ghi; đổi người bằng `switchUser`):
 * quản lý công ty tạo yêu cầu giao, lấy toạ độ từ danh sách địa danh mẫu → điều phối viên tạo chuyến có giờ xuất phát và kho đi, không
 * nhập điểm giao → đưa hai yêu cầu cùng nơi vào chuyến: điểm giao tự sinh và gộp → đưa kiện Đã nhập thẳng vào một điểm giao tay →
 * gỡ yêu cầu: điểm tự sinh hết kiện tự mất, điểm tay ở lại.
 *
 * Kỳ vọng chép tay từ seed (`seed-sourcing.ts`, `seed-places.ts`): REQ-001 giao KCN Hoà Khánh (16,0747 – 108,1506), ưu tiên Thấp, hai
 * kiện; sáu thùng bánh quy PK-0029…0034 (loại kiện `MP-BQ`) và sáu thùng sữa PK-0023…0028 còn tự do; chuyến mới là TRIP-015, yêu cầu
 * mới là REQ-007. CI không có khoá map tiles: ô chọn toạ độ chỉ có danh sách địa danh và hai ô gõ.
 */
test.use({ collectConsoleErrors: true })

/** Hạn sau hôm nay ba ngày: ở tương lai theo đồng hồ của kho (giờ thật) ở mọi múi giờ. */
const dueDate = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

test('stops are generated and merged from delivery requirements; loose pool packages go on a hand-added stop', async ({ page, login, browserErrors }) => {
  test.setTimeout(3 * 60_000)

  // Quản lý công ty: yêu cầu mới tới KCN Hoà Khánh, toạ độ lấy từ danh sách địa danh mẫu (FE-4b-03)
  await login('/yeu-cau-giao', 'manager')
  await page.getByRole('button', { name: 'Tạo yêu cầu giao', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Tạo yêu cầu giao' })
  await form.getByRole('textbox', { name: 'Tên điểm đến', exact: true }).fill('Xưởng Hoà Khánh')
  const coordinates = form.getByRole('group', { name: 'Toạ độ điểm đến' })
  // Không có khoá map tiles: không có bản đồ bấm chọn
  await expect(coordinates.locator('[data-coordinate-map]')).toHaveCount(0)
  await coordinates.getByRole('combobox', { name: 'Tìm địa danh', exact: true }).fill('kcn hoa khanh')
  await expect(coordinates.getByRole('option')).toHaveText([/^KCN Hoà Khánh/])
  await page.keyboard.press('Enter')
  await expect(coordinates.getByRole('textbox', { name: 'Vĩ độ', exact: true })).toHaveValue('16.0747')
  await expect(coordinates.getByRole('textbox', { name: 'Kinh độ', exact: true })).toHaveValue('108.1506')
  // Ô địa chỉ đang trống nên được điền theo địa danh — trùng địa chỉ của REQ-001
  await expect(form.getByRole('textbox', { name: 'Địa chỉ', exact: true })).toHaveValue('KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng')
  await form.getByLabel('Hạn giao').fill(dueDate())
  await form.getByRole('combobox', { name: 'Ưu tiên', exact: true }).click()
  await page.getByRole('option', { name: 'Cao', exact: true }).click()
  await form.getByRole('searchbox', { name: 'Lọc theo điểm đến ghi trong file, mã kiện' }).fill('PK-0023')
  await form.getByRole('checkbox', { name: /^PK-0023/ }).click()
  await form.getByRole('button', { name: 'Tạo yêu cầu', exact: true }).click()
  await expect(form).toBeHidden()
  await expect(page.getByRole('row', { name: /REQ-007/ })).toContainText('Xưởng Hoà Khánh')

  // Điều phối viên: tạo chuyến — giờ xuất phát, kho đi mặc định của công ty, không có ô điểm giao (FE-4b-04)
  await switchUser(page, 'dispatcher')
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Chuyến hàng', exact: true }).click()
  await page.getByRole('link', { name: 'Tạo chuyến', exact: true }).first().click()
  await page.waitForURL(/\/chuyen\/moi$/)
  await page.getByRole('textbox', { name: 'Tên chuyến', exact: true }).fill('Tuyến Đà Nẵng E2E')
  await page.getByLabel('Giờ xuất phát', { exact: true }).fill('05:45')
  await expect(page.getByRole('textbox', { name: 'Tên kho', exact: true })).toHaveValue('Kho Long Bình')
  await expect(page.getByRole('group', { name: 'Toạ độ kho' }).getByRole('textbox', { name: 'Vĩ độ', exact: true })).toHaveValue('10.9294')
  await expect(page.getByRole('textbox', { name: /điểm giao/ })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Xe', exact: true }).click()
  await page.getByRole('option', { name: 'Truck 6m', exact: true }).click()
  await page.getByRole('button', { name: 'Tạo chuyến', exact: true }).click()
  await page.waitForURL(/\/chuyen\/TRIP-015$/)
  const route = page.getByRole('region', { name: 'Sơ đồ tuyến' })
  const stops = route.getByRole('button', { name: /^Lọc kiện theo điểm/ })
  await expect(route).toContainText('Kho Long Bình')
  await expect(route).toContainText('Dự kiến xuất phát 05:45')
  await expect(stops).toHaveCount(0)
  // Chưa có điểm giao thì chưa gõ kiện tay được
  await expect(page.getByRole('button', { name: 'Thêm kiện', exact: true })).toHaveCount(0)

  // Đưa REQ-001 vào chuyến: điểm 1 tự sinh, mang hạn và ưu tiên của yêu cầu
  const onTrip = page.getByRole('region', { name: 'Yêu cầu giao của chuyến', exact: true })
  const assign = page.getByRole('dialog', { name: 'Đưa yêu cầu giao vào Tuyến Đà Nẵng E2E' })
  await onTrip.getByRole('button', { name: 'Đưa yêu cầu vào chuyến', exact: true }).click()
  await assign.getByRole('combobox', { name: 'Yêu cầu giao', exact: true }).click()
  await page.getByRole('option', { name: /^REQ-001 · KCN Hoà Khánh/ }).click()
  await expect(assign.getByRole('status')).toHaveText('Điểm giao: chuyến có thêm điểm 1 · KCN Hoà Khánh ở cuối tuyến.')
  await assign.getByRole('button', { name: 'Đưa vào chuyến', exact: true }).click()
  await expect(assign).toBeHidden()
  await expect(stops).toHaveText([/KCN Hoà Khánh/])
  await expect(route.getByRole('listitem').filter({ hasText: 'KCN Hoà Khánh' })).toContainText('Thấp')

  // REQ-007 cùng địa chỉ và toạ độ: gộp vào điểm 1, ưu tiên của điểm lên Cao; chuyến vẫn một điểm giao
  await onTrip.getByRole('button', { name: 'Đưa yêu cầu vào chuyến', exact: true }).click()
  await assign.getByRole('combobox', { name: 'Yêu cầu giao', exact: true }).click()
  await page.getByRole('option', { name: /^REQ-007 · Xưởng Hoà Khánh/ }).click()
  await expect(assign.getByRole('status')).toHaveText('Điểm giao: gộp vào điểm 1 · KCN Hoà Khánh — cùng địa chỉ và toạ độ.')
  await assign.getByRole('button', { name: 'Đưa vào chuyến', exact: true }).click()
  await expect(assign).toBeHidden()
  await expect(route.getByRole('listitem').filter({ hasText: 'KCN Hoà Khánh' })).toContainText('Cao')
  await expect(stops).toHaveCount(1)
  await expect(onTrip.getByRole('listitem')).toHaveCount(2)

  // Kiện Đã nhập đưa thẳng vào chuyến, gán điểm giao tay mới (FE-4b-05)
  const pool = page.getByRole('region', { name: 'Kiện đưa thẳng từ kho kiện', exact: true })
  await pool.getByRole('button', { name: 'Thêm kiện từ kho kiện', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Thêm kiện từ kho kiện' })
  // Điểm tự sinh của yêu cầu giao không nằm trong ô chọn điểm: mặc định tạo điểm mới
  await expect(picker.getByRole('combobox', { name: 'Điểm giao', exact: true })).toHaveText('Tạo điểm giao mới')
  await picker.getByRole('textbox', { name: 'Tên điểm giao', exact: true }).fill('Xưởng bánh kẹo Tân Bình')
  await picker.getByRole('combobox', { name: 'Tìm địa danh', exact: true }).fill('kcn tan binh')
  await picker.getByRole('option', { name: /KCN Tân Bình/ }).click()
  await picker.getByRole('searchbox', { name: 'Lọc theo điểm đến ghi trong file, mã kiện' }).fill('MP-BQ')
  await picker.getByRole('checkbox', { name: /^PK-0029/ }).click()
  await picker.getByRole('checkbox', { name: /^PK-0030/ }).click()
  await picker.getByRole('button', { name: 'Đưa vào chuyến', exact: true }).click()
  await expect(picker).toBeHidden()
  await expect(stops).toHaveText([/KCN Hoà Khánh/, /Xưởng bánh kẹo Tân Bình/])
  await expect(pool.getByRole('listitem')).toHaveCount(2)
  await expect(pool).toContainText('Điểm 2 · Xưởng bánh kẹo Tân Bình')
  // Hai thùng bánh quy gộp một dòng kiện; có điểm giao tay rồi thì gõ kiện tay được
  await expect(page.getByRole('region', { name: 'Kiện hàng' }).getByRole('row', { name: /Thùng bánh quy/ })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Thêm kiện', exact: true })).toBeVisible()

  // Gỡ hai yêu cầu: điểm tự sinh hết kiện tự mất; điểm tay ở lại và thành điểm 1
  await onTrip.getByRole('button', { name: 'Gỡ yêu cầu REQ-001', exact: true }).click()
  await expect(onTrip.getByRole('listitem')).toHaveCount(1)
  await expect(stops).toHaveCount(2)
  await onTrip.getByRole('button', { name: 'Gỡ yêu cầu REQ-007', exact: true }).click()
  await expect(stops).toHaveText([/Xưởng bánh kẹo Tân Bình/])
  await expect(pool).toContainText('Điểm 1 · Xưởng bánh kẹo Tân Bình')

  // Bỏ một kiện khỏi chuyến: kiện về "Đã nhập" ở Kho kiện
  await pool.getByRole('button', { name: 'Bỏ kiện PK-0030 khỏi chuyến', exact: true }).click()
  await expect(pool.getByRole('listitem')).toHaveCount(1)
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Kho kiện', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  await page.getByRole('tab', { name: /^Đã gán chuyến/ }).click()
  await expect(page.getByRole('row', { name: /PK-00/ })).toHaveCount(1)
  await expect(page.getByRole('row', { name: /PK-0029/ }).getByRole('link', { name: 'TRIP-015', exact: true })).toHaveAttribute('href', '/chuyen/TRIP-015')
  expect(browserErrors).toStrictEqual([])
})
