import { expect, test } from './fixtures'
import { signInWith } from './spec-flow-helpers'

/**
 * Khách chưa có tài khoản: mở gốc `/` thì sang trang giới thiệu, xem bảng giá, chọn một gói rồi gửi yêu cầu liên hệ. Hỗ trợ khách hàng
 * đăng nhập ngay trên tab đó — không tải lại trang, kho in-memory còn giữ yêu cầu vừa gửi — và xử lý nó ở màn Liên hệ của khách.
 * Seed có LH-001 → LH-003 (một yêu cầu Mới) nên yêu cầu của khách là LH-004.
 */
test.use({ collectConsoleErrors: true })

test('a guest picks a plan on the pricing page and sends a request; customer support finds it and takes it on', async ({ page, browserErrors }) => {
  await page.goto('/')
  await page.waitForURL(/\/gioi-thieu$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tận dụng thùng xe, dỡ đúng thứ tự, theo dõi tới điểm giao cuối.' })).toBeVisible()

  await page.getByRole('main').getByRole('link', { name: 'Xem bảng giá', exact: true }).click()
  await page.waitForURL(/\/bang-gia$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Bảng giá', exact: true })).toBeVisible()
  const pro = page.getByRole('group', { name: 'Pro', exact: true })
  await expect(pro).toContainText('Giá trị tạm — chờ chốt')
  await pro.getByRole('link', { name: 'Liên hệ tư vấn gói Pro', exact: true }).click()

  // Form liên hệ cuộn vào khung nhìn, chọn sẵn loại yêu cầu và gói vừa bấm
  await page.waitForURL(/\/gioi-thieu\?goi=PLAN-002&loai=bao-gia#lien-he$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Liên hệ với LoadMaster', exact: true })).toBeInViewport()
  await expect(page.getByRole('combobox', { name: 'Bạn cần gì', exact: true })).toHaveText('Báo giá')
  await expect(page.getByRole('combobox', { name: 'Gói quan tâm', exact: true })).toHaveText('Pro')
  await page.getByRole('textbox', { name: 'Họ tên', exact: true }).fill('Đỗ Văn Hưng')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('hung.do@vantaisongtien.vn')
  await page.getByRole('textbox', { name: 'Tên công ty', exact: true }).fill('Vận tải Sông Tiền')
  await page.getByRole('textbox', { name: 'Nội dung', exact: true }).fill('Đội 8 xe tải chạy miền Tây, cần báo giá gói Pro.')
  await page.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Đã ghi nhận yêu cầu LH-004', exact: true })).toBeFocused()

  // "Đăng nhập" của đầu trang đổi route phía client: kho in-memory còn nguyên
  await page.getByRole('banner').getByRole('link', { name: 'Đăng nhập', exact: true }).click()
  await page.waitForURL(/\/dang-nhap$/)
  await signInWith(page, 'hotro@loadmaster.vn')
  await page.waitForURL(/\/ho-tro$/)

  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Liên hệ của khách', exact: true }).click()
  await page.waitForURL(/\/lien-he-khach$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Liên hệ của khách', exact: true })).toBeVisible()
  await expect(page.getByText('4 yêu cầu · 2 mới', { exact: true })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: 'LH-004' })
  await expect(row.getByRole('cell')).toContainText(['Đỗ Văn Hưng', 'hung.do@vantaisongtien.vn', 'Báo giá', 'Pro', 'Mới', 'Chưa ai nhận'])

  await row.getByRole('link', { name: 'Mở yêu cầu LH-004 của Đỗ Văn Hưng', exact: true }).click()
  await page.waitForURL(/\?lien-he=LH-004$/)
  const panel = page.getByRole('region', { name: 'Đỗ Văn Hưng', exact: true })
  await expect(panel).toContainText('Đội 8 xe tải chạy miền Tây, cần báo giá gói Pro.')
  await expect(panel).toContainText('Vận tải Sông Tiền')

  // Nhận việc: đổi trạng thái và giao cho chính mình — số yêu cầu mới giảm, dòng đổi theo (không dựa vào toast)
  await panel.getByRole('combobox', { name: 'Trạng thái', exact: true }).click()
  await page.getByRole('option', { name: 'Đang xử lý', exact: true }).click()
  await panel.getByRole('combobox', { name: 'Người nhận việc', exact: true }).click()
  await page.getByRole('option', { name: 'Tạ Thị Ngọc Ánh · Hỗ trợ khách hàng', exact: true }).click()
  await panel.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(page.getByText('4 yêu cầu · 1 mới', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Lưu thay đổi', exact: true })).toBeDisabled()
  await expect(page.getByRole('row').filter({ hasText: 'LH-004' })).toContainText('Đang xử lý')

  expect(browserErrors).toStrictEqual([])
})
