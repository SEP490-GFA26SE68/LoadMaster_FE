import { expect, test } from './fixtures'
import { navigateInApp, SEED_TRIP, signInWith, signOutInApp } from './spec-flow-helpers'

/**
 * Phân quyền giả lập ở FE (LM-084, D-41): mỗi vai trò mở đúng màn chính, nav chỉ có mục được phép, route không có quyền là 403
 * có lối về, quản lý xem chuyến và phương án chỉ đọc. FE-0-01, FE-0-03: tám vai trò của PRD v2, tài khoản của hai công ty, quản trị hệ
 * thống không còn quyền vận hành. FE-0-07: điều phối viên duyệt phương án, hàng đợi `/duyet` đã bỏ. FE-0-06: không còn nhà sản xuất,
 * logistics, lô hàng và nhận hàng; ba màn kiện là của điều phối viên.
 */

/** Mỗi tài khoản demo → màn chính của vai trò và tiêu đề của màn đó (không phải màn 403 hay 404). */
const HOMES: readonly (readonly [email: string, path: string, heading: string])[] = [
  // Nền tảng: quản lý nền tảng mở danh mục gói (FE-8-02); hỗ trợ khách hàng tạm mở hồ sơ cá nhân tới khi có màn riêng (quyết định G1)
  ['quantri@loadmaster.vn', '/nguoi-dung', 'Người dùng'],
  ['nentang@loadmaster.vn', '/nen-tang/goi', 'Gói cước'],
  ['hotro@loadmaster.vn', '/ho-so', 'Hồ sơ cá nhân'],
  // Long Bình
  ['qtcongty@loadmaster.vn', '/nguoi-dung', 'Người dùng'],
  ['quanly@loadmaster.vn', '/', 'Bảng điều khiển'],
  ['dieuphoi@loadmaster.vn', '/chuyen', 'Chuyến hàng'],
  ['kho@loadmaster.vn', '/kho', 'Chuyến cần xếp'],
  ['taixe@loadmaster.vn', '/tai-xe', 'Chuyến của tôi'],
  // Phương Nam: đủ năm vai trò công ty — `viet.lam@` là nhân viên kho (FE-0-06)
  ['qtcongty@phuongnam.vn', '/nguoi-dung', 'Người dùng'],
  ['quanly@phuongnam.vn', '/', 'Bảng điều khiển'],
  ['dieuphoi@phuongnam.vn', '/chuyen', 'Chuyến hàng'],
  ['viet.lam@phuongnam.vn', '/kho', 'Chuyến cần xếp'],
  ['taixe@phuongnam.vn', '/tai-xe', 'Chuyến của tôi'],
]

test('every demo account signs in and lands on the home screen of its role (FE-0-03)', async ({ page, browserErrors }) => {
  await page.goto('/')
  for (const [email, path, heading] of HOMES) {
    await signInWith(page, email)
    await expect.poll(() => new URL(page.url()).pathname, { message: email }).toBe(path)
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true }), email).toBeVisible()
    await signOutInApp(page)
  }
  expect(browserErrors).toStrictEqual([])
})

test('the quick sign-in box groups accounts by platform and company; picking one fills the form (FE-0-03)', async ({ page, browserErrors }) => {
  await page.goto('/')
  const roles = (group: string) => page.getByRole('group', { name: group, exact: true }).getByRole('button')
  // Quản lý nền tảng và hỗ trợ khách hàng chưa có màn riêng nên chưa nằm trong ô chọn nhanh
  await expect(roles('Nền tảng')).toHaveText([/^Quản trị hệ thống\s*quantri@loadmaster\.vn$/])
  await expect(roles('Công ty TNHH Vận tải Long Bình')).toHaveText([
    /^Quản trị công ty\s*qtcongty@loadmaster\.vn$/, /^Quản lý công ty\s*quanly@loadmaster\.vn$/, /^Điều phối viên\s*dieuphoi@loadmaster\.vn$/,
    /^Nhân viên kho\s*kho@loadmaster\.vn$/, /^Tài xế\s*taixe@loadmaster\.vn$/,
  ])
  await expect(roles('Công ty CP Giao nhận Phương Nam')).toHaveText([
    /^Quản trị công ty\s*qtcongty@phuongnam\.vn$/, /^Quản lý công ty\s*quanly@phuongnam\.vn$/, /^Điều phối viên\s*dieuphoi@phuongnam\.vn$/,
    /^Nhân viên kho\s*viet\.lam@phuongnam\.vn$/, /^Tài xế\s*taixe@phuongnam\.vn$/,
  ])
  // Ba nhóm: nền tảng và hai công ty logistics — không còn nhóm của nhà sản xuất, không dòng nào mang nhãn vai trò đã bỏ (FE-0-06)
  await expect(page.getByRole('group')).toHaveCount(3)
  await expect(page.getByText(/Nhà sản xuất|logistics/i)).toHaveCount(0)

  await roles('Công ty CP Giao nhận Phương Nam').filter({ hasText: 'Điều phối viên' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('dieuphoi@phuongnam.vn')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/chuyen')
  await expect(page.getByRole('button', { name: 'Tài khoản Kiều Anh Tuấn', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('customer support has no nav items and is never stranded: logo, 403 and 404 lead back to the profile (FE-0-03)', async ({ page, browserErrors }) => {
  await page.goto('/')
  await signInWith(page, 'hotro@loadmaster.vn')
  await page.waitForURL((url) => url.pathname === '/ho-so')
  // Logo trước (thanh điều hướng đã dựng), rồi mới khẳng định thanh đó không có khay mục nào
  await expect(page.getByRole('link', { name: 'LoadMaster — về màn chính', exact: true })).toHaveAttribute('href', '/ho-so')
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toHaveCount(0)
  // Menu tài khoản: vai trò, không có dòng kho (người dùng nền tảng không thuộc kho nào)
  await page.getByRole('button', { name: /^Tài khoản / }).click()
  await expect(page.getByRole('menu')).toContainText('Hỗ trợ khách hàng')
  await page.keyboard.press('Escape')

  await navigateInApp(page, '/chuyen')
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/ho-so')

  await navigateInApp(page, '/duyet')
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/ho-so')
  await expect(page.getByRole('heading', { level: 1, name: 'Hồ sơ cá nhân', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('the system administrator has users and the audit log only: trips, fleet and the dashboard are forbidden (FE-0-01)', async ({ page, login, browserErrors }) => {
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await login('/', 'systemAdmin')
  await page.waitForURL((url) => url.pathname === '/nguoi-dung')
  await expect(nav.getByRole('link')).toHaveText(['Người dùng', 'Nhật ký'])
  for (const route of ['/', '/chuyen', `/chuyen/${SEED_TRIP}/phuong-an`, '/doi-xe', '/kho', '/tai-xe']) {
    await navigateInApp(page, route)
    await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true }), route).toBeVisible()
    // Về màn chính trước khi thử route kế tiếp: màn 403 của route trước không được làm route sau đạt thay
    await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/nguoi-dung')
    await expect(page.getByRole('heading', { level: 1, name: 'Người dùng', exact: true }), route).toBeVisible()
  }
  expect(browserErrors).toStrictEqual([])
})

test('the company manager lands on the dashboard and sees its own nav items: requirements to edit, the pool read-only (FE-0-04, FE-4b-02)', async ({ page, login, browserErrors }) => {
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await login('/', 'manager')
  await page.waitForURL((url) => url.pathname === '/')
  await expect(nav.getByRole('link')).toHaveText(['Bảng điều khiển', 'Yêu cầu giao', 'Kho kiện', 'Chuyến hàng', 'Giám sát', 'Đội xe'])
  // Yêu cầu giao là việc của quản lý công ty (D-72): có nút tạo
  await nav.getByRole('link', { name: 'Yêu cầu giao', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/yeu-cau-giao')
  await expect(page.getByRole('heading', { level: 1, name: 'Yêu cầu giao', exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: /REQ-/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo yêu cầu giao', exact: true })).toBeVisible()
  // Kho kiện với quản lý công ty là màn chỉ đọc (FE-3b-03): không thêm kiện, không nhập file, không chọn kiện in nhãn, không gỡ cờ
  await nav.getByRole('link', { name: 'Kho kiện', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kien-hang')
  await expect(page.getByText('2.951 kiện trong kho kiện', { exact: true })).toBeVisible()
  for (const name of ['Thêm kiện', 'Nhập file']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Loại kiện', exact: true })).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Cờ', exact: true }).click()
  await page.getByRole('option', { name: 'Hư hỏng', exact: true }).click()
  await page.getByRole('button', { name: 'AM-BHA-2609-05', exact: true }).click()
  const packagePanel = page.getByRole('complementary', { name: 'Chi tiết kiện AM-BHA-2609-05' })
  await expect(packagePanel.getByRole('img', { name: /^Mã QR LM-/ })).toBeVisible()
  await expect(packagePanel.getByRole('button', { name: /Gỡ cờ/ })).toHaveCount(0)
  await expect(packagePanel.getByRole('link', { name: 'In nhãn QR', exact: true })).toHaveCount(0)
  // Danh sách chuyến: quản lý không duyệt phương án nên không có "cần bạn xử lý"
  await nav.getByRole('link', { name: 'Chuyến hàng', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/chuyen')
  const hero = page.getByRole('heading', { level: 1, name: 'Chuyến hàng', exact: true }).locator('xpath=ancestor::header[1]')
  await expect(hero).toContainText('đang vận chuyển')
  await expect(hero).not.toContainText('cần bạn xử lý')
  expect(browserErrors).toStrictEqual([])
})

test('the dispatcher owns the package screens; the shipment and receiving routes are gone for everyone (FE-0-06)', async ({ page, login, browserErrors }) => {
  const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
  await login('/', 'dispatcher')
  await page.waitForURL((url) => url.pathname === '/chuyen')
  await expect(nav.getByRole('link')).toHaveText(['Chuyến hàng', 'Giám sát', 'Kho kiện', 'Yêu cầu giao', 'Đội xe', 'Bảng điều khiển'])
  // Yêu cầu giao với điều phối viên là màn chỉ xem (FE-4b-02): không nút tạo
  await nav.getByRole('link', { name: 'Yêu cầu giao', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/yeu-cau-giao')
  await expect(page.getByRole('row', { name: /REQ-/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo yêu cầu giao', exact: true })).toHaveCount(0)
  await nav.getByRole('link', { name: 'Kho kiện', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kien-hang')
  await expect(page.getByRole('heading', { level: 1, name: 'Kho kiện', exact: true })).toBeVisible()
  // Điều phối viên thấy cả 2.951 kiện của kho kiện Long Bình: 88 kiện có từ trước và 2.863 kiện của các chuyến seed (FE-3b-07)
  await expect(page.getByText('2.951 kiện trong kho kiện', { exact: true })).toBeVisible()

  // Lô hàng và nhận hàng: đường dẫn cũ là màn 404 (không phải 403), có lối về màn chính
  for (const route of ['/lo-hang', '/lo-hang/SHP-002', '/nhan-hang']) {
    await navigateInApp(page, route)
    await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang', exact: true }), route).toBeVisible()
    await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
    await page.waitForURL((url) => url.pathname === '/chuyen')
    await expect(page.getByRole('heading', { level: 1, name: 'Chuyến hàng', exact: true }), route).toBeVisible()
  }
  expect(browserErrors).toStrictEqual([])
})

test('a warehouse worker of the second company opening the package screens gets 403 with a way back to the warehouse (FE-0-06)', async ({ page, browserErrors }) => {
  await page.goto('/kien-hang')
  await signInWith(page, 'viet.lam@phuongnam.vn')
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kho')
  await expect(page.getByRole('heading', { level: 1, name: 'Chuyến cần xếp', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tài khoản Lâm Quốc Việt', exact: true })).toBeVisible()
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

test('the company manager reads trips and plans without any write action; the approval queue is gone (FE-0-07)', async ({ page, login, browserErrors }) => {
  await login(`/chuyen/${SEED_TRIP}`, 'manager')
  await expect(page.getByRole('heading', { name: 'Kiện hàng', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Chạy tối ưu', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Thêm kiện', exact: true })).toHaveCount(0)
  // Chuyến Đã lập kế hoạch: "Đổi xe" là nút mở hộp thoại (FE-5b-08); chuyến nháp là liên kết tới form sửa
  await expect(page.getByRole('button', { name: 'Đổi xe', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Đổi xe', exact: true })).toHaveCount(0)

  // Planner chỉ xem, cả bản đã duyệt lẫn bản chưa duyệt REV-001: không Chỉnh sửa, không Duyệt, một dòng lý do
  for (const route of [`/chuyen/${SEED_TRIP}/phuong-an`, `/chuyen/${SEED_TRIP}/phuong-an?revision=REV-001`]) {
    await navigateInApp(page, route)
    await page.locator('canvas').waitFor()
    await expect(page.getByText('MOCK RESULT', { exact: true }), route).toBeVisible()
    await expect(page.locator('[data-planner-lock="readOnly"]'), route).toHaveText('Chỉ xem: chỉ điều phối viên chỉnh sửa và duyệt phương án.')
    for (const name of ['Chỉnh sửa', 'Duyệt phương án', 'Duyệt bản chỉnh']) {
      await expect(page.getByRole('button', { name, exact: true }), `${route}: ${name}`).toHaveCount(0)
    }
  }

  await navigateInApp(page, `/chuyen/${SEED_TRIP}/toi-uu`)
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập', exact: true })).toBeVisible()
  // Hàng đợi duyệt của quản lý đã bỏ: đường dẫn cũ là màn 404 (không phải 403), có lối về màn chính
  await navigateInApp(page, '/duyet')
  await expect(page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Về màn chính', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/')
  expect(browserErrors).toStrictEqual([])
})

test('the dispatcher edits and approves an unapproved plan: no lock, no line about waiting for someone else (FE-0-07)', async ({ page, login, browserErrors }) => {
  await login(`/chuyen/${SEED_TRIP}/phuong-an?revision=REV-001`, 'dispatcher')
  await page.locator('canvas').waitFor()
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Chỉnh sửa', exact: true })).toBeVisible()
  await expect(page.locator('[data-planner-lock]')).toHaveCount(0)
  await expect(page.getByText(/quản lý công ty/i)).toHaveCount(0)
  expect(browserErrors).toStrictEqual([])
})
