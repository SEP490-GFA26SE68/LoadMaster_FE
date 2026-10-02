import { expect, test } from './fixtures'

/**
 * Đăng ký kiện và in nhãn QR (LM-104). Từ FE-0-06 đây là việc của điều phối viên (`packages.manage`): thêm loại kiện → đăng ký kiện
 * theo số lượng → trang in nhãn có mã QR. Phần tạo lô hàng và bàn giao cho công ty logistics đã bỏ cùng hai màn đó. Kho nằm trong bộ
 * nhớ trang nên mọi bước đi bằng liên kết trong app, không tải lại trang.
 * Seed neo 14/09/2026: 8 loại kiện (`PT-001…008`), kho kiện Long Bình 88 kiện (`PK-0001…0088`, FE-3b-01) — đều "Đã nhập".
 */
test('the dispatcher adds a package type, registers packages and prints their QR labels', async ({ page, login, browserErrors }) => {
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await login('/loai-kien', 'dispatcher')
  await expect(page.getByRole('heading', { level: 1, name: 'Loại kiện', exact: true })).toBeVisible()

  // 1. Loại kiện mới
  await page.getByRole('button', { name: 'Thêm loại kiện', exact: true }).click()
  const typeDialog = page.getByRole('dialog', { name: 'Thêm loại kiện' })
  await typeDialog.getByRole('textbox', { name: 'Tên loại kiện', exact: true }).fill('Thùng nước mắm 12 chai')
  await typeDialog.getByRole('spinbutton', { name: 'Dài', exact: true }).fill('40')
  await typeDialog.getByRole('spinbutton', { name: 'Rộng', exact: true }).fill('30')
  await typeDialog.getByRole('spinbutton', { name: 'Cao', exact: true }).fill('28')
  await typeDialog.getByRole('spinbutton', { name: 'Khối lượng', exact: true }).fill('15')
  await typeDialog.getByRole('button', { name: 'Thêm loại kiện', exact: true }).click()
  await expect(typeDialog).toBeHidden()
  await expect(page.getByRole('cell', { name: 'Thùng nước mắm 12 chai PT-009' })).toBeVisible()
  await expect(page.getByText('9 loại kiện trong danh mục', { exact: true })).toBeVisible()

  // 2. Màn Kiện hàng từ thanh điều hướng của điều phối viên: cả 88 kiện của kho kiện, tab theo bảy trạng thái của backend
  await nav.getByRole('link', { name: 'Kiện hàng', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  await expect(page.getByText('88 kiện đã đăng ký', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveText([
    /^Tất cả\s*88$/, /^Đã nhập\s*88$/, /^Đã gán chuyến\s*0$/, /^Đã soạn\s*0$/, /^Đã xếp\s*0$/, /^Đang vận chuyển\s*0$/, /^Đã giao\s*0$/, /^Hoàn trả\s*0$/,
  ])

  // Đăng ký 5 kiện theo số lượng: không có ô chọn công ty — kiện thuộc công ty của người đăng ký; điểm đến là trường bắt buộc của kiện
  await page.getByRole('button', { name: 'Đăng ký kiện', exact: true }).click()
  const registerDialog = page.getByRole('dialog', { name: 'Đăng ký kiện' })
  await registerDialog.getByRole('button', { name: 'Theo số lượng', exact: true }).click()
  await expect(registerDialog.getByRole('combobox')).toHaveCount(1)
  await registerDialog.getByRole('combobox', { name: 'Loại kiện', exact: true }).click()
  await page.getByRole('option', { name: 'Thùng nước mắm 12 chai · PT-009', exact: true }).click()
  await registerDialog.getByRole('spinbutton', { name: 'Số lượng', exact: true }).fill('5')
  await registerDialog.getByRole('textbox', { name: 'Mã lô / SKU', exact: true }).fill('MP-NM12-0914')
  // Thiếu điểm đến thì không đăng ký được
  await registerDialog.getByRole('button', { name: 'Đăng ký 5 kiện', exact: true }).click()
  await expect(registerDialog.getByText('Nhập điểm đến.', { exact: true })).toBeVisible()
  await registerDialog.getByRole('textbox', { name: 'Điểm đến', exact: true }).fill('KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng')
  await registerDialog.getByRole('button', { name: 'Đăng ký 5 kiện', exact: true }).click()
  await expect(registerDialog).toBeHidden()
  await expect(page.getByText('93 kiện đã đăng ký', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Đã nhập/ })).toHaveText(/^Đã nhập\s*93$/)
  // Kiện vừa đăng ký được chọn sẵn để in nhãn; dải thao tác chỉ còn bỏ chọn và in nhãn
  const selection = page.getByRole('region', { name: 'Đã chọn 5 kiện' })
  await expect(selection).toBeVisible()
  await expect(selection.getByRole('button', { name: 'Tạo lô hàng', exact: true })).toHaveCount(0)
  await expect(selection.getByRole('link', { name: 'Tạo lô hàng', exact: true })).toHaveCount(0)
  for (const id of ['PK-0089', 'PK-0093']) {
    await expect(page.getByRole('checkbox', { name: `Chọn kiện ${id}`, exact: true })).toBeChecked()
  }
  await expect(page.getByRole('row', { name: /PK-0093/ })).toContainText('Đã nhập')
  await expect(page.getByRole('row', { name: /PK-0093/ })).toContainText('MP-NM12-0914-05')

  // 3. Trang in nhãn: đúng 5 nhãn, mỗi nhãn một mã QR, kèm tên công ty của điều phối viên
  await selection.getByRole('link', { name: 'In nhãn QR', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kien-hang/nhan' && url.searchParams.get('kien') === 'PK-0089,PK-0090,PK-0091,PK-0092,PK-0093')
  await expect(page.getByText('5 nhãn có thể in', { exact: true })).toBeVisible()
  const sheet = page.getByRole('region', { name: 'Trang nhãn QR' })
  await expect(sheet.getByRole('img', { name: /^Mã QR LM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/ })).toHaveCount(5)
  await expect(sheet.getByRole('article', { name: 'PK-0089', exact: true })).toContainText('Mã MP-NM12-0914-01')
  await expect(sheet.getByRole('article', { name: 'PK-0089', exact: true })).toContainText('KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng')
  await expect(sheet.getByRole('article', { name: 'PK-0089', exact: true })).toContainText('Công ty TNHH Vận tải Long Bình')
  const labelsHero = page.getByRole('heading', { level: 1, name: 'In nhãn QR', exact: true }).locator('xpath=ancestor::header[1]')
  await expect(labelsHero.getByRole('button', { name: 'In nhãn', exact: true })).toBeEnabled()
  // Mục Kiện hàng vẫn là mục đang mở ở trang in nhãn
  await expect(nav.getByRole('link', { name: 'Kiện hàng', exact: true })).toHaveAttribute('aria-current', 'page')

  // 4. Về danh sách kiện, rồi sang Loại kiện bằng nút trên dải tiêu đề và quay lại — thanh điều hướng không có mục Loại kiện
  await labelsHero.getByRole('link', { name: 'Về danh sách kiện', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  const packagesHero = page.getByRole('heading', { level: 1, name: 'Kiện hàng', exact: true }).locator('xpath=ancestor::header[1]')
  await expect(nav.getByRole('link')).toHaveText(['Chuyến hàng', 'Kiện hàng', 'Đơn hàng', 'Đội xe', 'Bảng điều khiển'])
  await packagesHero.getByRole('link', { name: 'Loại kiện', exact: true }).click()
  await page.waitForURL(/\/loai-kien$/)
  await expect(page.getByRole('button', { name: /^Xoá Thùng nước mắm 12 chai\. Còn 5 kiện dùng loại này/ })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('heading', { level: 1, name: 'Loại kiện', exact: true }).locator('xpath=ancestor::header[1]').getByRole('link', { name: 'Về danh sách kiện', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  await expect(page.getByText('93 kiện đã đăng ký', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('a package type still used by the company cannot be deleted, and the reason is shown on the spot', async ({ page, login, browserErrors }) => {
  await login('/loai-kien', 'dispatcher')
  const blocked = page.getByRole('button', { name: /^Xoá Thùng nước suối 24 chai\. Còn 12 kiện dùng loại này/ })
  await expect(blocked).toHaveAttribute('aria-disabled', 'true')
  // Loại chưa có kiện nào thì xoá được sau khi xác nhận
  await page.getByRole('button', { name: 'Xoá Thùng nồi cơm điện', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Xoá loại kiện Thùng nồi cơm điện?' })
  await confirm.getByRole('button', { name: 'Xoá loại kiện', exact: true }).click()
  await expect(confirm).toBeHidden()
  await expect(page.getByText('7 loại kiện trong danh mục', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
