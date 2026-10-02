import { expect, test } from './fixtures'
import { addStop, optimizeRoute } from './spec-flow-helpers'

/**
 * FE-4b-06, FE-4b-09 — phân tách hàng và tối ưu tuyến ở Chi tiết chuyến, trên kho in-memory của trang (không tải lại trang sau khi
 * ghi): điều phối viên tạo chuyến → đưa hai yêu cầu giao hàng thường vào chuyến → đưa một kiện giá trị cao từ kho kiện: kho từ chối,
 * hộp vượt luật hỏi lý do → tối ưu tuyến ba điểm: thứ tự gần nhất trước, giờ đến dự kiến, mức hạn, MOCK RESULT, bản đồ; chuyến Nháp
 * → Đã lập kế hoạch → đổi thứ tự bằng bàn phím: giờ đến tính lại, chuyến vẫn Đã lập kế hoạch → thêm một điểm: chuyến về Nháp, điểm
 * chưa có toạ độ chặn tối ưu.
 *
 * Kỳ vọng chép tay từ seed (`seed-sourcing.ts`, `seed-packages.ts`, `seed-places.ts`): REQ-005 tới Siêu thị Co.opmart Bình Dương
 * (10,979 · 106,673) và REQ-006 tới Kho Bách Hoá Xanh Dĩ An (10,896 · 106,789) đều là hàng thường; PK-0064 `TL-HNI-2609-01` là hàng
 * giá trị cao; KCN Tân Bình ở 10,817 · 106,62; Kho Long Bình ở 10,9294 · 106,8747. Từ kho, Dĩ An gần nhất (≈ 10 km), rồi Bình Dương
 * (≈ 16 km từ Dĩ An, gần hơn Tân Bình ≈ 20 km), cuối cùng Tân Bình. Hạn của hai yêu cầu sau hôm nay hai ngày nên đều kịp hạn.
 */
test.use({ collectConsoleErrors: true })

test('mixed handling classes need a reason; the route of three stops is optimized, reordered by keyboard and falls back to draft when a stop is added', async ({ page, login, browserErrors }) => {
  test.setTimeout(3 * 60_000)

  await login('/chuyen/moi', 'dispatcher')
  await page.getByRole('textbox', { name: 'Tên chuyến', exact: true }).fill('Tuyến tối ưu tuyến E2E')
  await page.getByRole('combobox', { name: 'Xe', exact: true }).click()
  await page.getByRole('option', { name: 'Truck 6m', exact: true }).click()
  await page.getByRole('button', { name: 'Tạo chuyến', exact: true }).click()
  await page.waitForURL(/\/chuyen\/TRIP-015$/)
  const header = page.locator('header')
  const route = page.getByRole('region', { name: 'Sơ đồ tuyến' })
  const stops = route.getByRole('button', { name: /^Lọc kiện theo điểm/ })
  const groups = page.getByRole('region', { name: 'Phân nhóm hàng', exact: true })
  await expect(header.getByText('Nháp', { exact: true })).toBeVisible()
  // Chuyến chưa có điểm giao: chưa tối ưu tuyến được, nút mờ kèm lý do
  await expect(route.getByRole('button', { name: 'Tối ưu tuyến', exact: true })).toBeDisabled()
  await expect(route).toContainText('Chuyến chưa có điểm giao nên chưa tối ưu tuyến được.')
  await expect(groups).toContainText('Chuyến chưa có kiện.')

  // Hai yêu cầu hàng thường: Bình Dương là điểm 1 — kiện đầu tiên khoá chuyến ở hàng thường
  const onTrip = page.getByRole('region', { name: 'Yêu cầu giao của chuyến', exact: true })
  const assign = page.getByRole('dialog', { name: 'Đưa yêu cầu giao vào Tuyến tối ưu tuyến E2E' })
  await onTrip.getByRole('button', { name: 'Đưa yêu cầu vào chuyến', exact: true }).click()
  await assign.getByRole('combobox', { name: 'Yêu cầu giao', exact: true }).click()
  await page.getByRole('option', { name: /^REQ-005 · Siêu thị Co.opmart Bình Dương/ }).click()
  await assign.getByRole('button', { name: 'Đưa vào chuyến', exact: true }).click()
  await expect(assign).toBeHidden()
  await expect(groups.getByRole('list', { name: 'Số kiện theo loại hàng' })).toHaveText('Thường12 kiện')

  // Kiện giá trị cao đưa thẳng từ kho kiện vào điểm tay mới: kho từ chối, hộp vượt luật hỏi lý do (FE-4b-06)
  const pool = page.getByRole('region', { name: 'Kiện đưa thẳng từ kho kiện', exact: true })
  await pool.getByRole('button', { name: 'Thêm kiện từ kho kiện', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Thêm kiện từ kho kiện' })
  await picker.getByRole('textbox', { name: 'Tên điểm giao', exact: true }).fill('Xưởng Tân Bình')
  await picker.getByRole('combobox', { name: 'Tìm địa danh', exact: true }).fill('kcn tan binh')
  await picker.getByRole('option', { name: /KCN Tân Bình/ }).click()
  await picker.getByRole('searchbox', { name: 'Lọc theo điểm đến ghi trong file, mã kiện' }).fill('PK-0064')
  await picker.getByRole('checkbox', { name: /^PK-0064/ }).click()
  await picker.getByRole('button', { name: 'Đưa vào chuyến', exact: true }).click()
  const override = page.getByRole('dialog', { name: 'Chở chung kiện khác loại hàng' })
  await expect(override).toContainText('Loại hàng của chuyếnThường')
  await expect(override).toContainText('TL-HNI-2609-01')
  // Lý do bắt buộc
  await override.getByRole('button', { name: 'Lưu lý do', exact: true }).click()
  await expect(override.getByText('Cần ghi lý do.', { exact: true })).toBeVisible()
  await override.getByRole('textbox', { name: 'Lý do chở chung', exact: true }).fill('Khách gom chung một xe, hàng giá trị cao để trong lồng khoá')
  await override.getByRole('button', { name: 'Lưu lý do', exact: true }).click()
  await expect(override).toBeHidden()
  await expect(picker).toBeHidden()
  await expect(stops).toHaveText([/Siêu thị Co.opmart Bình Dương/, /Xưởng Tân Bình/])
  // Thẻ Phân nhóm hàng: loại đang khoá, kiện khác loại và lý do; kiểm tra trước khi tối ưu chỉ còn cảnh báo
  await expect(groups).toContainText('1 kiện khác loại')
  await expect(groups).toContainText('Giá trị cao · 1 kiện')
  await expect(groups).toContainText('Khách gom chung một xe, hàng giá trị cao để trong lồng khoá')
  await expect(page.getByRole('region', { name: 'Kiểm tra trước khi tối ưu' })).toContainText('1 kiện khác loại hàng, đã ghi lý do chở chung')

  await onTrip.getByRole('button', { name: 'Đưa yêu cầu vào chuyến', exact: true }).click()
  await assign.getByRole('combobox', { name: 'Yêu cầu giao', exact: true }).click()
  await page.getByRole('option', { name: /^REQ-006 · Kho Bách Hoá Xanh Dĩ An/ }).click()
  await assign.getByRole('button', { name: 'Đưa vào chuyến', exact: true }).click()
  await expect(assign).toBeHidden()
  await expect(stops).toHaveText([/Siêu thị Co.opmart Bình Dương/, /Xưởng Tân Bình/, /Kho Bách Hoá Xanh Dĩ An/])

  // Tối ưu tuyến ba điểm (FE-4b-09): gần nhất trước, chuyến thành Đã lập kế hoạch, kết quả mang nhãn MOCK RESULT
  await expect(route).toContainText('Chưa tối ưu tuyến.')
  await optimizeRoute(page)
  await expect(stops).toHaveText([/Kho Bách Hoá Xanh Dĩ An/, /Siêu thị Co.opmart Bình Dương/, /Xưởng Tân Bình/])
  await expect(header.getByText('Đã lập kế hoạch', { exact: true })).toBeVisible()
  await expect(route.getByText('MOCK RESULT', { exact: true })).toBeVisible()
  const items = route.getByRole('list', { name: /^Kho xuất phát rồi 3 điểm giao/ }).getByRole('listitem')
  // Mỗi điểm có giờ đến dự kiến; hai điểm của yêu cầu giao có hạn nên có mức hạn, điểm tay thì không
  for (const index of [1, 2, 3]) await expect(items.nth(index)).toContainText(/Dự kiến đến \d{2}:\d{2} \d{2}\/\d{2}/)
  await expect(items.nth(1).getByText('Kịp hạn', { exact: true })).toBeVisible()
  await expect(items.nth(2).getByText('Kịp hạn', { exact: true })).toBeVisible()
  await expect(items.nth(3).getByText(/hạn/)).toHaveCount(0)
  await expect(route.getByRole('region', { name: 'Bản đồ tuyến TRIP-015' }).getByRole('listitem')).toHaveText([
    'Kho xuất phát: Kho Long Bình', 'Điểm 1: Kho Bách Hoá Xanh Dĩ An', 'Điểm 2: Siêu thị Co.opmart Bình Dương', 'Điểm 3: Xưởng Tân Bình',
  ])
  // Kiện đi theo điểm của nó: kiện giá trị cao giờ ở điểm 3
  await expect(pool).toContainText('Điểm 3 · Xưởng Tân Bình')

  // Kéo đổi thứ tự bằng bàn phím: Dĩ An xuống sau Bình Dương — giờ đến tính lại, chuyến vẫn Đã lập kế hoạch
  const etaBefore = await items.nth(1).getByText(/^Dự kiến đến/).textContent()
  const handle = route.getByRole('button', { name: 'Kéo để đổi thứ tự Kho Bách Hoá Xanh Dĩ An', exact: true })
  await handle.focus()
  await page.keyboard.press('Space')
  // dnd-kit báo đang nhấc bằng `aria-pressed`; chờ nó rồi mới bấm mũi tên, và chờ thẻ dời chỗ rồi mới thả
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  await page.keyboard.press('Space')
  await expect(stops).toHaveText([/Siêu thị Co.opmart Bình Dương/, /Kho Bách Hoá Xanh Dĩ An/, /Xưởng Tân Bình/])
  await expect(items.nth(1).getByText(/^Dự kiến đến/)).not.toHaveText(etaBefore ?? '')
  await expect(header.getByText('Đã lập kế hoạch', { exact: true })).toBeVisible()
  await expect(route.getByText('Tuyến đã tối ưu', { exact: true })).toBeVisible()

  // Thêm một điểm tay sau khi đã tối ưu: chuyến về Nháp; điểm chưa có toạ độ chặn tối ưu, lỗi chỉ đúng điểm 4
  await addStop(page, { name: 'Cửa hàng chưa có toạ độ' })
  await expect(header.getByText('Nháp', { exact: true })).toBeVisible()
  await expect(route).toContainText('Chưa tối ưu tuyến.')
  const four = route.getByRole('list', { name: /^Kho xuất phát rồi 4 điểm giao/ }).getByRole('listitem')
  await expect(four.nth(1)).not.toContainText('Dự kiến đến')
  await expect(four.nth(4).getByText('Chưa có toạ độ', { exact: true })).toBeVisible()
  await route.getByRole('button', { name: 'Tối ưu tuyến', exact: true }).click()
  await expect(route.getByRole('alert')).toHaveText('Điểm giao số 4 chưa có toạ độ nên chưa tối ưu tuyến được.')
  await expect(header.getByText('Nháp', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
