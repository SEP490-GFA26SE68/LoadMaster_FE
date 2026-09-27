import { expect, test } from './fixtures'
import { navigateInApp, SEED_TRIP } from './spec-flow-helpers'

/**
 * Phân quyền giả lập ở FE (LM-084, D-41): mỗi vai trò mở đúng màn chính, nav chỉ có mục được phép, route không có quyền là 403
 * có lối về, quản lý xem chuyến và phương án chỉ đọc.
 */
test('each role lands on its own screen and sees only its nav items', async ({ page, login, browserErrors }) => {
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await login('/', 'manager')
  await page.waitForURL((url) => url.pathname === '/')
  await expect(nav.getByRole('link')).toHaveText(['Bảng điều khiển', 'Chuyến hàng', 'Chờ duyệt', 'Đội xe'])
  expect(browserErrors).toStrictEqual([])
})

test('manufacturer and logistics land on their Review 1 screens inside the app shell (LM-104)', async ({ page, login, browserErrors }) => {
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await login('/', 'manufacturer')
  await page.waitForURL((url) => url.pathname === '/kien-hang')
  await expect(page.getByRole('heading', { level: 1, name: 'Kiện hàng', exact: true })).toBeVisible()
  await expect(nav.getByRole('link')).toHaveText(['Kiện hàng', 'Lô hàng', 'Loại kiện'])
  await expect(page.getByText('42 kiện đã đăng ký', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('a logistics user opening the manufacturer screen gets 403 with a way back to receiving', async ({ page, login, browserErrors }) => {
  await login('/kien-hang', 'logistics')
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/nhan-hang')
  await expect(page.getByText('8 kiện đang chờ quét nhận', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('a driver opening the admin screen gets 403 with a way back', { tag: '@phone' }, async ({ page, login, browserErrors }) => {
  await login('/nguoi-dung', 'driver')
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/tai-xe')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến của tôi', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('the company manager reads trips without editing them and is the one who approves plans (LM-104)', async ({ page, login, browserErrors }) => {
  await login(`/chuyen/${SEED_TRIP}`, 'manager')
  await expect(page.getByRole('heading', { name: 'Kiện hàng', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Chạy tối ưu', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Thêm kiện', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Đổi xe', exact: true })).toHaveCount(0)

  // Bản chưa duyệt REV-001: quản lý công ty có Chỉnh sửa và Duyệt, không có dòng khoá
  await navigateInApp(page, `/chuyen/${SEED_TRIP}/phuong-an?revision=REV-001`)
  await page.locator('canvas').waitFor()
  await expect(page.getByText('MOCK RESULT', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toBeVisible()
  await expect(page.locator('[data-planner-lock]')).toHaveCount(0)

  await navigateInApp(page, `/chuyen/${SEED_TRIP}/toi-uu`)
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('the dispatcher cannot approve an unapproved plan, waiting for the company manager, but may still edit it (LM-104, LM-108)', async ({ page, login, browserErrors }) => {
  await login(`/chuyen/${SEED_TRIP}/phuong-an?revision=REV-001`, 'dispatcher')
  await page.locator('canvas').waitFor()
  await expect(page.locator('[data-planner-lock="awaitingApproval"]'))
    .toHaveText('Chờ quản lý công ty duyệt. Bạn vẫn chỉnh tay được — "Lưu bản chỉnh" gửi bản mới cho quản lý.')
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
