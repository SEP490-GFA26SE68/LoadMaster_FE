import { expect, test } from './fixtures'

/**
 * Kho kiện `/kien-hang` của điều phối viên (FE-3b-03, FE-3b-02): thêm loại kiện → thêm một kiện gắn loại đó (mã QR có ngay) → in nhãn;
 * nhập file `.csv` có xem trước; tải file mẫu. Kho nằm trong bộ nhớ trang nên mọi bước đi bằng liên kết trong app, không tải lại trang.
 * Seed neo 14/09/2026: 8 loại kiện (`PT-001…008`), kho kiện Long Bình 2.951 kiện — 88 kiện `PK-0001…0088` đều "Đã nhập" đứng đầu bảng,
 * rồi 2.863 kiện nhập tay của 15 chuyến seed (`PK-T…`, FE-3b-07) mang trạng thái theo tiến độ chuyến.
 */
const HEADER = 'package_code,length,width,height,weight,handling_class,destination,package_type'
const csv = (lines: readonly string[]) => ({ name: 'kien.csv', mimeType: 'text/csv', buffer: Buffer.from([HEADER, ...lines].join('\r\n'), 'utf8') })

test('the dispatcher adds a package type, adds a package that gets its QR code at once and prints its label', async ({ page, login, browserErrors }) => {
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

  // 2. Kho kiện từ thanh điều hướng: cả 2.951 kiện, tab theo bảy trạng thái của backend, kiện mới nhất đứng đầu. Đã nhập: 88 kiện có từ
  // trước + 170 kiện của chuyến đã huỷ TRIP-004 + 1 kiện kho báo thiếu của TRIP-003
  await nav.getByRole('link', { name: 'Kho kiện', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  await expect(page.getByText('2.951 kiện trong kho kiện', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveText([
    /^Tất cả\s*2\.951$/, /^Đã nhập\s*259$/, /^Đã gán chuyến\s*548$/, /^Đã soạn\s*280$/, /^Đã xếp\s*210$/, /^Đang vận chuyển\s*120$/, /^Đã giao\s*1\.533$/,
    /^Hoàn trả\s*1$/,
  ])
  await expect(page.getByRole('row', { name: /PK-00/ }).first()).toContainText('PK-0088')

  // 3. Thêm một kiện: không có cách thêm theo loại kiện / theo số lượng; thiếu trường thì form nói rõ
  await page.getByRole('button', { name: 'Thêm kiện', exact: true }).click()
  const addDialog = page.getByRole('dialog', { name: 'Thêm kiện' })
  await expect(addDialog.getByRole('button', { name: 'Theo số lượng', exact: true })).toHaveCount(0)
  await expect(addDialog.getByRole('spinbutton', { name: 'Số lượng', exact: true })).toHaveCount(0)
  await addDialog.getByRole('button', { name: 'Thêm kiện', exact: true }).click()
  await expect(addDialog.getByText('Nhập điểm đến.', { exact: true })).toBeVisible()
  await addDialog.getByRole('textbox', { name: 'Mã kiện của bên gửi', exact: true }).fill('NM-DNG-0914-01')
  await addDialog.getByRole('spinbutton', { name: 'Dài', exact: true }).fill('40')
  await addDialog.getByRole('spinbutton', { name: 'Rộng', exact: true }).fill('30')
  await addDialog.getByRole('spinbutton', { name: 'Cao', exact: true }).fill('28')
  await addDialog.getByRole('spinbutton', { name: 'Khối lượng', exact: true }).fill('15')
  await addDialog.getByRole('combobox', { name: 'Loại hàng', exact: true }).click()
  await page.getByRole('option', { name: 'Dễ vỡ', exact: true }).click()
  await addDialog.getByRole('textbox', { name: 'Điểm đến', exact: true }).fill('KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng')
  await addDialog.getByRole('combobox', { name: 'Loại kiện', exact: true }).click()
  await page.getByRole('option', { name: 'Thùng nước mắm 12 chai · PT-009', exact: true }).click()
  await addDialog.getByRole('button', { name: 'Thêm kiện', exact: true }).click()
  await expect(addDialog).toBeHidden()
  await expect(page.getByText('2.952 kiện trong kho kiện', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Đã nhập/ })).toHaveText(/^Đã nhập\s*260$/)

  // Chi tiết kiện vừa thêm mở ngay: mã QR đã có, lịch sử một mốc; kiện đứng đầu bảng
  const panel = page.getByRole('complementary', { name: 'Chi tiết kiện NM-DNG-0914-01' })
  await expect(panel.getByRole('img', { name: /^Mã QR LM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/ })).toBeVisible()
  await expect(panel).toContainText('Thùng nước mắm 12 chai · PT-009')
  await expect(panel.getByRole('list', { name: 'Lịch sử' }).getByRole('listitem')).toHaveText([/^Vào kho kiện: Thêm lẻ.*Nguyễn Thanh Tùng$/])
  const row = page.getByRole('row', { name: /PK-0089/ })
  await expect(row).toContainText('NM-DNG-0914-01')
  await expect(row).toContainText('Đã nhập')
  await expect(row).toContainText('Dễ vỡ')

  // 4. In nhãn từ panel: đúng một nhãn theo mẫu mới (FE-3b-05) — mã của bên gửi, loại hàng, số đo, điểm đến, dòng "Hàng dễ vỡ", tên công ty
  await panel.getByRole('link', { name: 'In nhãn QR', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kien-hang/nhan' && url.searchParams.get('kien') === 'PK-0089')
  await expect(page.getByText('1 nhãn có thể in', { exact: true })).toBeVisible()
  const sheet = page.getByRole('region', { name: 'Trang nhãn QR' })
  const label = sheet.getByRole('article', { name: 'PK-0089', exact: true })
  await expect(label.getByRole('img', { name: /^Mã QR LM-/ })).toBeVisible()
  await expect(label).toContainText('Mã bên gửiNM-DNG-0914-01')
  await expect(label).toContainText('Loại hàngDễ vỡ')
  await expect(label).toContainText('40 × 30 × 28 cm')
  await expect(label).toContainText('15 kg')
  await expect(label.getByText('Hàng dễ vỡ', { exact: true })).toBeVisible()
  await expect(label).toContainText('KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng')
  await expect(label).toContainText('Công ty TNHH Vận tải Long Bình')
  const labelsHero = page.getByRole('heading', { level: 1, name: 'In nhãn QR', exact: true }).locator('xpath=ancestor::header[1]')
  await expect(labelsHero.getByRole('button', { name: 'In nhãn', exact: true })).toBeEnabled()
  // Mục Kho kiện vẫn là mục đang mở ở trang in nhãn
  await expect(nav.getByRole('link', { name: 'Kho kiện', exact: true })).toHaveAttribute('aria-current', 'page')

  // 5. Về kho kiện, rồi sang Loại kiện bằng nút trên dải tiêu đề và quay lại — thanh điều hướng không có mục Loại kiện
  await labelsHero.getByRole('link', { name: 'Về kho kiện', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  const poolHero = page.getByRole('heading', { level: 1, name: 'Kho kiện', exact: true }).locator('xpath=ancestor::header[1]')
  await expect(nav.getByRole('link')).toHaveText(['Chuyến hàng', 'Kho kiện', 'Đơn hàng', 'Đội xe', 'Bảng điều khiển'])
  await poolHero.getByRole('link', { name: 'Loại kiện', exact: true }).click()
  await page.waitForURL(/\/loai-kien$/)
  await expect(page.getByRole('button', { name: /^Xoá Thùng nước mắm 12 chai\. Còn 1 kiện dùng loại này/ })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('heading', { level: 1, name: 'Loại kiện', exact: true }).locator('xpath=ancestor::header[1]').getByRole('link', { name: 'Về kho kiện', exact: true }).click()
  await page.waitForURL(/\/kien-hang$/)
  await expect(page.getByText('2.952 kiện trong kho kiện', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('importing a file: an error row blocks the whole file, a clean file is imported in one go; both templates download', async ({ page, login, browserErrors }) => {
  await login('/kien-hang', 'dispatcher')
  await expect(page.getByText('2.951 kiện trong kho kiện', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Nhập file', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập file vào kho kiện' })
  const confirm = dialog.getByRole('button', { name: /^Xác nhận nhập/ })
  await expect(confirm).toBeDisabled()

  // File mẫu: hai định dạng, tải ngay tại hộp thoại
  for (const format of ['xlsx', 'csv'] as const) {
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: `Tải mẫu .${format}`, exact: true }).click()])
    expect(download.suggestedFilename()).toBe(`mau-nhap-kho-kien.${format}`)
  }

  // Dòng 3 có chiều cao 0: cả file bị chặn, không kiện nào được tạo
  const file = dialog.getByLabel('File kiện (.csv, .xlsx)')
  await file.setInputFiles(csv(['DN-0001,60,40,40,18,STANDARD,"KCN Hoà Khánh, Đà Nẵng",', 'DN-0002,60,40,0,18,STANDARD,Huế,', 'DN-0003,50,40,30,"9,5",Dễ vỡ,Huế,']))
  await expect(dialog.getByText('1 dòng có lỗi nên chưa nhập được dòng nào. Sửa file rồi chọn lại.', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('group', { name: 'Kết quả kiểm tra file' }).getByRole('definition')).toHaveText(['3', '2', '1', '0'])
  await expect(dialog.getByRole('row', { name: /^3 / })).toContainText('Chiều cao phải là số lớn hơn 0')
  await expect(confirm).toBeDisabled()

  // File đã sửa; một mã đã có trong kho kiện chỉ là cảnh báo
  await file.setInputFiles(csv(['DN-0001,60,40,40,18,STANDARD,"KCN Hoà Khánh, Đà Nẵng",', 'DN-0002,60,40,35,18,STANDARD,Huế,', 'HK-DNG-2609-01,50,40,30,"9,5",Dễ vỡ,Huế,']))
  await expect(dialog.getByText('1 dòng có cảnh báo; vẫn nhập được.', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('row', { name: /^4 / })).toContainText('Mã kiện đã có trong kho kiện (PK-0049)')
  await dialog.getByRole('button', { name: 'Xác nhận nhập 3 kiện', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('2.954 kiện trong kho kiện', { exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: /PK-0091/ })).toContainText('HK-DNG-2609-01')
  await expect(page.getByRole('row', { name: /PK-0091/ })).toContainText('Dễ vỡ')

  // Kiện vừa nhập được chọn sẵn: in nhãn cho cả ba
  const selection = page.getByRole('region', { name: 'Đã chọn 3 kiện' })
  await selection.getByRole('link', { name: 'In nhãn QR', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kien-hang/nhan' && url.searchParams.get('kien') === 'PK-0089,PK-0090,PK-0091')
  await expect(page.getByRole('region', { name: 'Trang nhãn QR' }).getByRole('img', { name: /^Mã QR LM-/ })).toHaveCount(3)
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
