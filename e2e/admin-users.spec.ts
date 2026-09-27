import type { Page } from '@playwright/test'
import { DEMO_EMAILS, DEMO_PASSWORD, expect, test } from './fixtures'

/**
 * Quản trị người dùng (LM-092, D-42): tài khoản quản trị tạo đăng nhập được bằng mật khẩu tạm hiện một lần và mở đúng màn của vai
 * trò; khoá rồi thì đăng nhập báo khoá. Kho in-memory: đổi người dùng bằng đăng xuất/đăng nhập trong app, không `page.goto`.
 */
const NEW_DRIVER = { name: 'Mai Văn Phúc', email: 'phuc.mai@loadmaster.vn' }

async function signOutFromMenu(page: Page, name: string) {
  await page.getByRole('button', { name: `Tài khoản ${name}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click()
  await page.waitForURL(/\/dang-nhap$/)
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
}

test('a driver account the admin creates signs in with its one-time password; locked, it is refused', async ({ page, login, browserErrors }) => {
  await login('/nguoi-dung', 'admin')
  await page.getByRole('button', { name: 'Thêm người dùng', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Thêm người dùng', exact: true })
  await form.getByLabel('Họ và tên', { exact: true }).fill(NEW_DRIVER.name)
  await form.getByLabel('Số điện thoại', { exact: true }).fill('0915111222')
  await form.getByLabel('Email', { exact: true }).fill(NEW_DRIVER.email)
  await form.getByLabel('Kho / chi nhánh', { exact: true }).fill('Kho Long Bình')
  await form.getByRole('combobox', { name: 'Vai trò', exact: true }).click()
  await page.getByRole('option', { name: 'Tài xế', exact: true }).click()
  await form.getByRole('button', { name: 'Thêm người dùng', exact: true }).click()

  // Mật khẩu tạm chỉ hiện một lần, trong hộp thoại
  const result = page.getByRole('dialog', { name: `Đã tạo tài khoản ${NEW_DRIVER.name}`, exact: true })
  const password = await result.getByLabel('Mật khẩu tạm', { exact: true }).inputValue()
  expect(password).toMatch(/^[A-Za-z2-9]{10}$/)
  await result.getByRole('button', { name: 'Xong', exact: true }).click()
  await expect(page.getByRole('row', { name: new RegExp(NEW_DRIVER.name) })).toContainText('Đang hoạt động')

  await signOutFromMenu(page, 'Võ Minh Khoa')
  await signIn(page, NEW_DRIVER.email, password)
  // Tài xế đăng nhập mở "Chuyến của tôi" (LM-087) — màn chính của vai trò: nút thoát là đăng xuất
  await page.waitForURL(/\/tai-xe$/)
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).first().click()
  await page.waitForURL(/\/dang-nhap$/)

  await signIn(page, DEMO_EMAILS.admin, DEMO_PASSWORD)
  await page.waitForURL(/\/nguoi-dung$/)
  await page.getByRole('searchbox', { name: 'Tìm theo tên, email, số điện thoại, mã', exact: true }).fill('phuc.mai')
  // Lọc có debounce: chờ bảng còn đúng dòng cần rồi mới bấm, nếu không cú bấm rơi vào chỗ dòng vừa rời đi (máy chậm)
  await expect(page.getByRole('row')).toHaveCount(2)
  // Trên runner CI (chậm hơn máy dev nhiều) đôi khi cú bấm đầu không mở được menu Radix; không dựng lại được tại chỗ kể cả khi
  // bóp CPU 20×, và người dùng thật chỉ việc bấm lại — nên bấm lại cho tới khi menu mở, đừng đứng chờ một menu không bao giờ tới.
  const lock = page.getByRole('menuitem', { name: 'Khoá tài khoản', exact: true })
  await expect(async () => {
    await page.getByRole('button', { name: `Thao tác cho ${NEW_DRIVER.name}`, exact: true }).click()
    await expect(lock).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 30_000 })
  await lock.click()
  await expect(page.getByText(`Đã khoá tài khoản ${NEW_DRIVER.name}`, { exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(NEW_DRIVER.name) })).toContainText('Đã khoá')

  await signOutFromMenu(page, 'Võ Minh Khoa')
  await signIn(page, NEW_DRIVER.email, password)
  await expect(page.getByRole('alert')).toHaveText('Tài khoản đã bị khoá. Liên hệ quản trị hệ thống.')
  await expect(page).toHaveURL(/\/dang-nhap$/)
  expect(browserErrors).toStrictEqual([])
})

test('row click opens the user detail panel beside the table at 1366 px; the phone column steps aside and Esc closes it', async ({ page, login, browserErrors }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await login('/nguoi-dung', 'admin')
  const table = page.getByRole('table')
  const phoneHeader = table.getByRole('columnheader', { name: 'Điện thoại', exact: true })
  await expect(phoneHeader).toBeVisible()

  await page.getByRole('row', { name: /Nguyễn Thanh Tùng/ }).getByText('Kho Long Bình').click()
  const panel = page.getByRole('complementary', { name: 'Chi tiết tài khoản Nguyễn Thanh Tùng', exact: true })
  await expect(panel.getByRole('heading', { level: 2, name: 'Nguyễn Thanh Tùng', exact: true })).toBeFocused()
  await expect(panel).toContainText('0901 234 567')
  await expect(panel.getByRole('listitem')).toHaveCount(11)
  await expect(phoneHeader).toHaveCount(0)

  // Panel nằm cạnh bảng, không xuống dưới; không có gì cuộn ngang
  const [tableBox, panelBox] = await Promise.all([table.boundingBox(), panel.boundingBox()])
  expect(panelBox!.x).toBeGreaterThan(tableBox!.x + tableBox!.width)
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(1366)
  const overflowing = await page.evaluate(() => [...document.querySelectorAll('html, [role="tabpanel"], table')]
    .filter((element) => element.scrollWidth > element.clientWidth + 1).length)
  expect(overflowing).toBe(0)

  // Lăn chuột trên bảng: tab cuộn, panel dính lại trong khung nhìn
  await page.mouse.move(tableBox!.x + 200, 600)
  await page.mouse.wheel(0, 2000)
  await expect.poll(() => page.getByRole('tabpanel').evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(panel).toBeInViewport()

  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(phoneHeader).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nguyễn Thanh Tùng', exact: true })).toBeFocused()
  expect(browserErrors).toStrictEqual([])
})
