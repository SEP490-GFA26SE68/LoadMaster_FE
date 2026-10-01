import { expect, test } from './fixtures'

/**
 * LM-100: So sánh phương án `/chuyen/:tripId/so-sanh` (LM-051) — mọi cột revision mang MOCK RESULT, mở revision đang chọn vào
 * Planner; tiêu đề tab theo màn. Đường dẫn lạ ra màn 404, nút về màn chính mở đúng màn của vai trò.
 */
test.use({ collectConsoleErrors: true })

const TRIP_ID = 'TRIP-2026-0914'

test('compare plans: every revision column is MOCK RESULT and the chosen one opens in the Planner', async ({ page, login, browserErrors }) => {
  // Điều phối viên duyệt (FE-0-07): mở bản chưa duyệt thì có nút Duyệt
  await login(`/chuyen/${TRIP_ID}/so-sanh`, 'dispatcher')
  await expect(page.getByRole('heading', { level: 1, name: 'So sánh phương án', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(`So sánh phương án ${TRIP_ID} · LoadMaster`)
  // Dải trời V2.3: đường dẫn về chi tiết chuyến thay cho nút quay lại
  await expect(page.getByRole('navigation', { name: 'Vị trí trang' }).getByRole('link', { name: TRIP_ID, exact: true }))
    .toHaveAttribute('href', `/chuyen/${TRIP_ID}`)

  // Seed: bản tối ưu REV-001 và bản đã duyệt REV-002 tạo từ nó — mỗi bản một cột, đầu cột có radio chọn bản
  const radios = page.getByRole('radio')
  await expect(radios).toHaveCount(2)
  await expect(page.getByRole('columnheader').filter({ hasText: 'MOCK RESULT' })).toHaveCount(2)
  await expect(page.getByRole('radio', { name: 'REV-002', exact: true })).toBeChecked()

  await page.getByRole('radio', { name: 'REV-001', exact: true }).check()
  await expect(page.getByRole('radio', { name: 'REV-001', exact: true })).toBeChecked()
  await expect(page.getByText('Đang chọn: REV-001', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Mở REV-001 trong 3D', exact: true }).click()
  await page.waitForURL(`/chuyen/${TRIP_ID}/phuong-an?revision=REV-001`)
  await page.locator('canvas').waitFor()
  const header = page.locator('header').first()
  await expect(header).toContainText('MOCK RESULT')
  // REV-001 chưa duyệt: Planner mở đúng bản đó (bản đã duyệt REV-002 không có nút Duyệt)
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toBeVisible()
  await expect(page).toHaveTitle(`Phương án ${TRIP_ID} · LoadMaster`)
  expect(browserErrors).toStrictEqual([])
})

test('an unknown path shows the 404 screen and its home button opens the role home', async ({ page, login }) => {
  await login('/tai-xe', 'driver')
  await page.goto('/duong-dan-khong-co')
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang', exact: true })).toBeVisible()
  await expect(page.getByText('404', { exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Không tìm thấy trang · LoadMaster')

  // Tài xế không mở được bảng điều khiển `/`: nút về màn chính phải đưa về "Chuyến của tôi", không ra màn 403
  await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/tai-xe')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến của tôi', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Chuyến của tôi · LoadMaster')
})
