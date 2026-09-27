import { expect, test } from './fixtures'

/**
 * Luồng 1 Review 1 phía nhà sản xuất (LM-104): thêm loại kiện → đăng ký kiện theo số lượng → trang in nhãn có mã QR → tạo lô hàng →
 * bàn giao cho công ty logistics. Kho nằm trong bộ nhớ trang nên mọi bước đi bằng liên kết trong app, không tải lại trang.
 * Seed neo 14/09/2026: 8 loại kiện (`PT-001…008`), 48 kiện (`RPK-0001…0048`), lô `SHP-001…003`.
 */
test('the manufacturer registers packages, prints their QR labels and hands a shipment over to logistics', async ({ page, login, browserErrors }) => {
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await login('/loai-kien', 'manufacturer')
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

  // 2. Đăng ký 5 kiện theo số lượng
  await nav.getByRole('link', { name: 'Kiện hàng', exact: true }).click()
  await expect(page.getByText('42 kiện đã đăng ký', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Đăng ký kiện', exact: true }).click()
  const registerDialog = page.getByRole('dialog', { name: 'Đăng ký kiện' })
  await registerDialog.getByRole('button', { name: 'Theo số lượng', exact: true }).click()
  await registerDialog.getByRole('combobox', { name: 'Loại kiện', exact: true }).click()
  await page.getByRole('option', { name: 'Thùng nước mắm 12 chai · PT-009', exact: true }).click()
  await registerDialog.getByRole('spinbutton', { name: 'Số lượng', exact: true }).fill('5')
  await registerDialog.getByRole('textbox', { name: 'Mã lô / SKU', exact: true }).fill('MP-NM12-0914')
  await registerDialog.getByRole('button', { name: 'Đăng ký 5 kiện', exact: true }).click()
  await expect(registerDialog).toBeHidden()
  await expect(page.getByText('47 kiện đã đăng ký', { exact: true })).toBeVisible()
  // Kiện vừa đăng ký được chọn sẵn để in nhãn
  const selection = page.getByRole('region', { name: 'Đã chọn 5 kiện' })
  await expect(selection).toBeVisible()
  for (const id of ['RPK-0049', 'RPK-0053']) {
    await expect(page.getByRole('checkbox', { name: `Chọn kiện ${id}`, exact: true })).toBeChecked()
  }

  // 3. Trang in nhãn: đúng 5 nhãn, mỗi nhãn một mã QR
  await selection.getByRole('link', { name: 'In nhãn QR', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kien-hang/nhan' && url.searchParams.get('kien') === 'RPK-0049,RPK-0050,RPK-0051,RPK-0052,RPK-0053')
  await expect(page.getByText('5 nhãn có thể in', { exact: true })).toBeVisible()
  const sheet = page.getByRole('region', { name: 'Trang nhãn QR' })
  await expect(sheet.getByRole('img', { name: /^Mã QR LM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/ })).toHaveCount(5)
  await expect(sheet.getByRole('article', { name: 'RPK-0049', exact: true })).toContainText('Lô MP-NM12-0914')
  const labelsHero = page.getByRole('heading', { level: 1, name: 'In nhãn QR', exact: true }).locator('xpath=ancestor::header[1]')
  await expect(labelsHero.getByRole('button', { name: 'In nhãn', exact: true })).toBeEnabled()

  // 4. Tạo lô hàng với 5 kiện mới
  await nav.getByRole('link', { name: 'Lô hàng', exact: true }).click()
  await expect(page.getByText('2 lô hàng', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Tạo lô hàng', exact: true }).click()
  const shipmentDialog = page.getByRole('dialog', { name: 'Tạo lô hàng' })
  await shipmentDialog.getByRole('combobox', { name: 'Công ty logistics nhận hàng', exact: true }).click()
  await page.getByRole('option', { name: 'Công ty TNHH Vận tải Long Bình', exact: true }).click()
  await shipmentDialog.getByRole('checkbox', { name: 'Chọn cả nhóm Thùng nước mắm 12 chai', exact: true }).click()
  await expect(shipmentDialog.getByText('Đã chọn 5 kiện', { exact: true })).toBeVisible()
  await shipmentDialog.getByRole('button', { name: 'Tạo lô hàng', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/lo-hang/SHP-004')
  const hero = page.getByRole('heading', { level: 1, name: 'Lô hàng SHP-004', exact: true }).locator('xpath=ancestor::header[1]')
  await expect(hero.getByText('Nháp', { exact: true })).toBeVisible()
  await expect(page.getByText('5 kiện trong lô, đã nhận 0', { exact: true })).toBeVisible()

  // 5. Bàn giao cho logistics: lô hết sửa được, kiện sang "Đang giao cho logistics"
  await hero.getByRole('button', { name: 'Bàn giao cho logistics', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Bàn giao lô SHP-004?' })
  await confirm.getByRole('button', { name: 'Bàn giao', exact: true }).click()
  await expect(confirm).toBeHidden()
  await expect(hero.getByText('Đã bàn giao', { exact: true })).toBeVisible()
  await expect(hero.getByRole('button', { name: 'Bàn giao cho logistics', exact: true })).toHaveCount(0)
  await expect(hero.getByRole('button', { name: 'Sửa lô', exact: true })).toHaveCount(0)

  await nav.getByRole('link', { name: 'Kiện hàng', exact: true }).click()
  await page.getByRole('tab', { name: /^Đang giao cho logistics/ }).click()
  await expect(page.getByRole('row', { name: /RPK-0053/ })).toContainText('Đang giao cho logistics')
  await expect(page.getByRole('row', { name: /RPK-0053/ })).toContainText('SHP-004')
  expect(browserErrors).toStrictEqual([])
})

test('a package type still used by the company cannot be deleted, and the reason is shown on the spot', async ({ page, login, browserErrors }) => {
  await login('/loai-kien', 'manufacturer')
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
