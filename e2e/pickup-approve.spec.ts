import { expect, test } from './fixtures'
import { MOCK_DB, overflowingText } from './spec-flow-helpers'

/**
 * FE-7-03, FE-7-04: điều phối viên gửi yêu cầu nhận hàng dọc đường cho chuyến `TRIP-009` đang vận chuyển, đọc mười luật Đạt / Không đạt,
 * duyệt, thấy hai điểm mới chèn vào tuyến và mở nhãn gửi bên gửi — cả luồng trên **một tab** (kho nằm trong bộ nhớ trang, không tải lại).
 * Kết quả mười luật phụ thuộc vị trí xe lúc chạy test nên kịch bản không đòi luật nào trượt: ô lý do vượt luật có thì điền, không có thì duyệt luôn.
 * Luật 4–7 và 10 đọc kết quả xếp kiện nhận vào vùng trống (FE-BL-01), không còn nhãn ước lượng; duyệt xong yêu cầu giữ chỗ của kiện.
 */
test.use({ collectConsoleErrors: true })

const TRIP = 'TRIP-009'

test('1.366 px: the dispatcher sends a pickup request, reads its ten rules, approves it, sees the inserted stops in the route and opens the sender labels', async ({ page, login, browserErrors }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await login(`/chuyen/${TRIP}`)
  const card = page.getByRole('region', { name: 'Nhận hàng dọc đường', exact: true })
  const route = page.getByRole('list', { name: /^Kho xuất phát rồi \d+ điểm giao/ })
  await expect(card.getByText('PKR-001', { exact: true })).toBeVisible()
  await expect(route.getByText('Nhận hàng', { exact: true })).toHaveCount(0)

  // Gửi yêu cầu: điểm nhận, điểm giao mới (không trùng điểm nào của chuyến), một kiện
  await card.getByRole('button', { name: 'Nhận hàng dọc đường', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: `Nhận hàng dọc đường — chuyến ${TRIP}` })
  const pickup = dialog.getByRole('group', { name: 'Điểm nhận hàng', exact: true })
  await pickup.getByRole('textbox', { name: 'Tên điểm', exact: true }).fill('Xưởng may Hoàng Gia')
  await pickup.getByRole('textbox', { name: 'Địa chỉ', exact: true }).fill('Đường số 4, KCN VSIP 1, Thuận An')
  await pickup.getByRole('textbox', { name: 'Vĩ độ', exact: true }).fill('10.928')
  await pickup.getByRole('textbox', { name: 'Kinh độ', exact: true }).fill('106.712')
  const delivery = dialog.getByRole('group', { name: 'Điểm giao hàng', exact: true })
  await delivery.getByRole('textbox', { name: 'Tên điểm', exact: true }).fill('Kho Dĩ An')
  await delivery.getByRole('textbox', { name: 'Địa chỉ', exact: true }).fill('1 Quốc lộ 1K, Dĩ An')
  await delivery.getByRole('textbox', { name: 'Vĩ độ', exact: true }).fill('10.9')
  await delivery.getByRole('textbox', { name: 'Kinh độ', exact: true }).fill('106.73')
  const box = dialog.getByRole('group', { name: 'Kiện 1', exact: true })
  await box.getByRole('textbox', { name: 'Mã của bên gửi', exact: true }).fill('HG-0801')
  await box.getByRole('textbox', { name: 'Dài (cm)', exact: true }).fill('60')
  await box.getByRole('textbox', { name: 'Rộng (cm)', exact: true }).fill('40')
  await box.getByRole('textbox', { name: 'Cao (cm)', exact: true }).fill('40')
  await box.getByRole('textbox', { name: 'Khối lượng (kg)', exact: true }).fill('12')
  await dialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click()

  // Mười luật ngay sau khi lưu: mỗi luật nói Đạt hoặc Không đạt bằng chữ, không luật nào còn nhãn ước lượng
  const result = page.getByRole('dialog', { name: /^Yêu cầu PKR-002/ })
  const rules = result.getByRole('list', { name: 'Mười luật nhận hàng', exact: true }).getByRole('listitem')
  await expect(rules).toHaveCount(10)
  for (const rule of await rules.all()) await expect(rule).toContainText(/Đạt|Không đạt/)
  await expect(result.getByText('Ước lượng')).toHaveCount(0)
  await result.getByRole('button', { name: 'Đóng', exact: true }).click()
  await expect(card.getByText('PKR-002', { exact: true })).toBeVisible()

  // Duyệt: kho kiểm lại luật; còn luật không đạt thì lý do vượt luật là bắt buộc
  await card.getByRole('button', { name: 'Duyệt yêu cầu PKR-002', exact: true }).click()
  const approve = page.getByRole('dialog', { name: 'Duyệt yêu cầu PKR-002', exact: true })
  const confirm = approve.getByRole('button', { name: 'Duyệt yêu cầu', exact: true })
  await expect(confirm).toBeEnabled()
  const reason = approve.getByRole('textbox', { name: 'Lý do vượt luật', exact: true })
  if (await reason.count() > 0) {
    await confirm.click()
    await expect(approve.getByText('Cần ghi lý do để duyệt khi còn luật không đạt.', { exact: true })).toBeVisible()
    await reason.fill('Khách quen, xe còn chỗ')
  }
  await confirm.click()
  const done = page.getByRole('dialog', { name: 'Đã duyệt yêu cầu PKR-002', exact: true })
  await expect(done.getByRole('listitem')).toHaveCount(1)
  await expect(done.getByRole('listitem')).toContainText(/^PK-\d{4}HG-0801 · mã QR LM-/)
  await expect(done.getByRole('link', { name: 'In nhãn gửi bên gửi', exact: true })).toHaveAttribute('href', /^\/kien-hang\/nhan\?kien=PK-\d{4}$/)
  await done.getByRole('button', { name: 'Đóng', exact: true }).click()

  // Điểm nhận và điểm giao mới nằm trong tuyến, điểm nhận có nhãn "Nhận hàng"; yêu cầu thành "Đã duyệt"
  await expect(route.getByText('Xưởng may Hoàng Gia', { exact: true })).toBeVisible()
  await expect(route.getByText('Kho Dĩ An', { exact: true })).toBeVisible()
  await expect(route.getByText('Nhận hàng', { exact: true })).toHaveCount(1)
  await expect(card.getByRole('listitem').filter({ hasText: 'PKR-002' })).toContainText('Đã duyệt — chờ nhận hàng')
  // Chữ mới của thẻ và của tuyến không tràn khung (điểm 1 đã giao có dấu kiểm nhô ra ngoài mốc từ trước, không thuộc kiểm này)
  expect((await overflowingText(page)).filter((line) => /Nhận hàng|PKR-|Xưởng may|Kho Dĩ An/.test(line))).toStrictEqual([])

  // Duyệt giữ chỗ của kiện nhận trên xe (kiện 60 × 40 × 40 vừa vùng đã trống của điểm 1) cùng yêu cầu
  const layout = await page.evaluate(async ({ db: dbUrl, trip }) => {
    const { getMockDb } = (await import(dbUrl)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    db.restoreSession('US-0001')
    return (await db.getPickupRequest(trip, 'PKR-002')).layout
  }, { db: MOCK_DB, trip: TRIP })
  expect(layout?.unplaced).toStrictEqual([])
  expect(layout?.placements).toHaveLength(1)

  // Nhãn gửi bên gửi: liên kết từ thẻ mở trang in nhãn của đúng kiện đó
  await card.getByRole('link', { name: 'In nhãn gửi bên gửi của yêu cầu PKR-002', exact: true }).click()
  await expect(page).toHaveURL(/\/kien-hang\/nhan\?kien=PK-\d{4}$/)
  await expect(page.getByRole('heading', { level: 1, name: 'In nhãn QR', exact: true })).toBeVisible()
  await expect(page.getByText('HG-0801', { exact: false }).first()).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
