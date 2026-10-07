import { expect, test } from './fixtures'

/**
 * Danh mục gói cước của quản lý nền tảng (FE-8-02, D-90): đăng nhập mở thẳng `/nen-tang/goi`; ba gói seed đều mang nhãn "Giá trị tạm
 * — chờ chốt"; sửa giá một gói thì giá đổi và nhãn của gói đó mất, hai gói kia vẫn giữ.
 */
test.use({ collectConsoleErrors: true })

test('the platform manager lands on the plan catalogue and editing a plan price clears its provisional tag', async ({ page, login, browserErrors }) => {
  await login('/', 'systemManager')
  await page.waitForURL((url) => url.pathname === '/nen-tang/goi')
  await expect(page.getByRole('heading', { level: 1, name: 'Gói cước', exact: true })).toBeVisible()

  const row = (code: string) => page.getByRole('row').filter({ hasText: code })
  const tag = page.getByText('Giá trị tạm — chờ chốt', { exact: true })
  await expect(tag).toHaveCount(3)
  await expect(row('PLAN-001')).toContainText('490.000 ₫ / tháng')

  await page.getByRole('button', { name: 'Thao tác với Basic', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Sửa', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('áp dụng từ kỳ gia hạn kế tiếp')
  await dialog.getByRole('spinbutton', { name: 'Giá mỗi tháng' }).fill('590000')
  await dialog.getByRole('button', { name: 'Lưu gói', exact: true }).click()

  await expect(row('PLAN-001')).toContainText('590.000 ₫ / tháng')
  await expect(row('PLAN-001').getByText('Giá trị tạm — chờ chốt')).toHaveCount(0)
  await expect(tag).toHaveCount(2)
  expect(browserErrors).toStrictEqual([])
})
