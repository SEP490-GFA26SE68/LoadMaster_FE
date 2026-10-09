import { expect, test } from './fixtures'
import { navigateInApp, signInWith, signOutInApp } from './spec-flow-helpers'

/**
 * Công ty (FE-8-06, D-65): quản trị hệ thống tạo công ty mới cùng Quản trị công ty đầu tiên — mật khẩu tạm hiện một lần —, công ty chưa có
 * gói; người quản trị đó đăng nhập bằng mật khẩu tạm, mở màn chính của mình (Người dùng) và chỉ thấy công ty vừa tạo.
 */
test.use({ collectConsoleErrors: true })

test('the system admin creates a company with its first admin, who then signs in with the temporary password', async ({ page, login, browserErrors }) => {
  await login('/nen-tang/cong-ty', 'systemAdmin')
  await expect(page.getByRole('heading', { level: 1, name: 'Công ty', exact: true })).toBeVisible()
  await expect(page.getByText('2 công ty', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Tạo công ty', exact: true }).click()
  const form = page.getByRole('dialog')
  const fill = (name: string, value: string) => form.getByRole('textbox', { name, exact: true }).fill(value)
  await fill('Tên công ty', 'Công ty TNHH Vận tải Biển Hồ')
  await fill('Địa chỉ', '25 Quốc lộ 1A, P. Tân Thới Hiệp, Quận 12')
  await fill('Số điện thoại công ty', '0283 812 3456')
  await fill('Tên kho', 'Kho Tân Thới Hiệp')
  await fill('Vĩ độ', '10.8631')
  await fill('Kinh độ', '106.6372')
  await fill('Họ tên', 'Hồ Thị Thu Hà')
  await fill('Số điện thoại', '0931 245 678')
  await fill('Email', 'ha.ho@bienho.vn')
  await form.getByRole('button', { name: 'Tạo công ty', exact: true }).click()

  // Mật khẩu tạm hiện một lần
  const password = await page.getByRole('textbox', { name: 'Mật khẩu tạm', exact: true }).inputValue()
  expect(password).toMatch(/^[A-Za-z2-9]{10}$/)
  await page.getByRole('button', { name: 'Xong', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Mật khẩu tạm', exact: true })).toHaveCount(0)
  await expect(page.getByText('3 công ty', { exact: true })).toBeVisible()
  const created = page.getByRole('row', { name: /Biển Hồ/ })
  await expect(created).toContainText('Chưa có gói')
  await expect(created.getByRole('cell').nth(3)).toHaveText('1')

  // Người quản trị đầu tiên: màn chính là Người dùng, chỉ thấy chính mình; công ty chưa có gói
  await signOutInApp(page)
  await signInWith(page, 'ha.ho@bienho.vn', password)
  await page.waitForURL((url) => url.pathname === '/nguoi-dung')
  await expect(page.getByRole('heading', { level: 1, name: 'Người dùng', exact: true })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.getByRole('row', { name: /Hồ Thị Thu Hà/ })).toContainText('ha.ho@bienho.vn')
  await navigateInApp(page, '/goi-cuoc')
  await expect(page.getByText('Công ty chưa có gói cước', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
