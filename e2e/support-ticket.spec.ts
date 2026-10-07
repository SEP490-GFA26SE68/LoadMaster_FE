import { expect, test } from './fixtures'
import { switchUser } from './spec-flow-helpers'

/**
 * Yêu cầu hỗ trợ (FE-8-07, D-67): điều phối viên gửi một yêu cầu thanh toán từ menu tài khoản; Hỗ trợ khách hàng mở màn chính `/ho-tro`,
 * trả lời (yêu cầu sang Đang xử lý), xem gói và số dư của công ty rồi đóng yêu cầu; điều phối viên thấy chuông báo có trả lời, mở lại
 * yêu cầu của mình và đọc câu trả lời — yêu cầu đã đóng không còn ô trả lời.
 */
test.use({ collectConsoleErrors: true })

test('a dispatcher sends a ticket, customer support replies and closes it, and the dispatcher reads the reply from the bell', async ({ page, login, browserErrors }) => {
  await login('/chuyen', 'dispatcher')
  await page.getByRole('button', { name: /^Tài khoản / }).click()
  await page.getByRole('menuitem', { name: 'Yêu cầu hỗ trợ', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: /^Mở yêu cầu / })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Gửi yêu cầu mới', exact: true }).click()
  await dialog.getByRole('combobox', { name: 'Loại yêu cầu', exact: true }).click()
  await page.getByRole('option', { name: 'Thanh toán', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Tiêu đề', exact: true }).fill('Hoá đơn tháng 9')
  await dialog.getByRole('textbox', { name: 'Mô tả', exact: true }).fill('Cần hoá đơn VAT của kỳ gia hạn gần nhất.')
  await dialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Hoá đơn tháng 9', exact: true })).toBeVisible()
  await expect(dialog.getByText('Chưa có trả lời.', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // Hỗ trợ khách hàng: màn chính là `/ho-tro`; mở yêu cầu, trả lời, đọc gói và số dư của công ty, đóng yêu cầu
  await switchUser(page, 'systemSupporter')
  await page.waitForURL((url) => url.pathname === '/ho-tro')
  await expect(page.getByRole('heading', { level: 1, name: 'Hỗ trợ khách hàng', exact: true })).toBeVisible()
  await page.getByRole('row', { name: /Hoá đơn tháng 9/ }).click()
  const thread = page.getByRole('region', { name: 'Hoá đơn tháng 9', exact: true })
  await thread.getByRole('textbox', { name: 'Trả lời', exact: true }).fill('Hoá đơn VAT gửi qua email quản trị công ty trong 2 ngày làm việc.')
  await thread.getByRole('button', { name: 'Gửi trả lời', exact: true }).click()
  await expect(thread.getByRole('combobox', { name: 'Trạng thái yêu cầu', exact: true })).toHaveText('Đang xử lý')
  const panel = page.getByRole('region', { name: 'Thông tin công ty', exact: true })
  await expect(panel).toContainText('Công ty TNHH Vận tải Long Bình')
  await expect(panel).toContainText('Pro')
  await expect(panel.getByText('Số dư credit', { exact: true }).locator('xpath=following-sibling::dd')).toHaveText('486')
  await thread.getByRole('combobox', { name: 'Trạng thái yêu cầu', exact: true }).click()
  await page.getByRole('option', { name: 'Đã đóng', exact: true }).click()
  await expect(thread.getByText('Yêu cầu đã đóng. Mở lại để trả lời tiếp.', { exact: true })).toBeVisible()

  // Người gửi: chuông có lần trả lời, yêu cầu của mình đã đóng và không còn ô trả lời
  await switchUser(page, 'dispatcher')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  const replied = page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Trả lời yêu cầu hỗ trợ' })
  await expect(replied).toHaveCount(1)
  await expect(replied).toContainText('Tạ Thị Ngọc Ánh')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Tài khoản / }).click()
  await page.getByRole('menuitem', { name: 'Yêu cầu hỗ trợ', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Mở yêu cầu Hoá đơn tháng 9', exact: true }).click()
  await expect(page.getByText('Hoá đơn VAT gửi qua email quản trị công ty trong 2 ngày làm việc.', { exact: true })).toBeVisible()
  await expect(page.getByText('Yêu cầu đã đóng nên không thêm trả lời được.', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Trả lời', exact: true })).toHaveCount(0)
  expect(browserErrors).toStrictEqual([])
})
