import { expect, test } from './fixtures'
import { navigateInApp, optimizeAndCompare, signInWith, signOutInApp } from './spec-flow-helpers'

/**
 * Gói cước và credit của công ty (FE-8-03, FE-8-04, D-89): quản trị công ty Phương Nam (gói Basic, còn 2 credit) nạp 50 credit qua
 * trang thanh toán giả lập — số dư lên 52, lịch sử credit có dòng Mua +50 và lịch sử thanh toán có giao dịch thành công —, rồi điều
 * phối viên của công ty thấy số dư mới ở Thiết lập tối ưu và chạy tối ưu được, mỗi lần chạy trừ một credit.
 */
test.use({ collectConsoleErrors: true })

test('a Phương Nam company admin tops up 50 credits through the simulated payment and the dispatcher then runs an optimisation', async ({ page, browserErrors }) => {
  await page.goto('/')
  await signInWith(page, 'qtcongty@phuongnam.vn')
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Gói và credit', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/goi-cuoc')
  await expect(page.getByRole('heading', { level: 1, name: 'Gói cước và credit', exact: true })).toBeVisible()

  const balance = page.getByRole('group', { name: 'Số dư', exact: true })
  await expect(page.getByRole('region', { name: 'Gói hiện tại', exact: true })).toContainText('Basic')
  await expect(balance).toContainText('2')

  await page.getByRole('button', { name: 'Nạp credit', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Tiếp tục thanh toán', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/thanh-toan/gia-lap' && /^PAY-\d+$/.test(url.searchParams.get('giao-dich') ?? ''))
  await expect(page.getByText('Nạp 50 credit', { exact: true })).toBeVisible()
  await expect(page.getByText(/thanh toán giả lập của bản demo/)).toBeVisible()
  await page.getByRole('button', { name: 'Thành công', exact: true }).click()

  // Về màn gói cước: số dư mới và cả hai lịch sử có dòng của lần nạp
  await page.waitForURL((url) => url.pathname === '/goi-cuoc')
  await expect(balance).toContainText('52')
  const rows = page.getByRole('table').getByRole('row')
  await expect(rows.nth(1)).toContainText('Mua')
  await expect(rows.nth(1)).toContainText('+50')
  await page.getByRole('tab', { name: /Thanh toán/ }).click()
  await expect(rows.nth(1)).toContainText('Nạp credit')
  await expect(rows.nth(1)).toContainText('50.000 ₫')
  await expect(rows.nth(1)).toContainText('Thành công')

  // Điều phối viên của công ty: số dư mới ở Thiết lập tối ưu, chạy được và bị trừ một credit
  await signOutInApp(page)
  await signInWith(page, 'dieuphoi@phuongnam.vn')
  const setup = '/chuyen/TRIP-PN-001/toi-uu'
  await navigateInApp(page, setup)
  const credit = page.getByRole('region', { name: 'Credit', exact: true })
  await expect(credit).toContainText('Lần chạy này dùng 1 credit · còn 52')
  await optimizeAndCompare(page)
  await navigateInApp(page, setup)
  await expect(credit).toContainText('Lần chạy này dùng 1 credit · còn 51')
  expect(browserErrors).toStrictEqual([])
})
