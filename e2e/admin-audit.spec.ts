import type { Locator, Page } from '@playwright/test'
import { DEMO_EMAILS, DEMO_PASSWORD, expect, test } from './fixtures'
import { MOCK_DB } from './spec-flow-helpers'

/**
 * Nhật ký hệ thống (LM-091, D-43): điều phối viên huỷ một chuyến, quản trị hệ thống đăng nhập trong cùng trang (kho in-memory) và
 * thấy sự kiện ở đầu nhật ký, lọc theo người làm ra đúng. Không `page.goto` sau khi ghi: tải lại là mất kho. FE-0-01: quản trị hệ
 * thống không xem được chuyến — tên chuyến trong nhật ký là chữ thường, còn tên người dùng vẫn dẫn tới màn Người dùng. FE-0-08: quản
 * trị hệ thống đọc cả hệ thống và lọc theo công ty; quản trị công ty chỉ đọc nhật ký của công ty mình, không có việc của tài khoản nền tảng.
 */

/**
 * Chữ các ô của hàng dữ liệu thứ `index` (0 là hàng đầu dưới tiêu đề), bỏ cột thời điểm — như trình đọc màn hình đọc: ô chữ tắt
 * và icon hành động (`aria-hidden`) chỉ để nhìn. Ô người làm đọc "tên vai trò".
 */
async function rowCells(page: Page, index: number) {
  return (await readableTexts(page.locator('tbody tr').nth(index).locator('td'))).slice(1)
}

async function readableTexts(cells: Locator) {
  const texts = await cells.evaluateAll((tds) => tds.map((td) => {
    const copy = td.cloneNode(true) as HTMLElement
    for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove()
    return copy.textContent ?? ''
  }))
  return texts.map((text) => text.replace(/\s+/g, ' ').trim())
}

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

/** Hôm nay theo giờ Việt Nam (UTC+7), `YYYY-MM-DD` — cùng mốc với seed. */
function vnToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

test('a trip the dispatcher cancels tops the system log and the log of its company, and filtering by who did it keeps it', async ({ page, login, browserErrors }) => {
  // Seed ghi sự kiện của hôm nay tới 16:00 giờ Việt Nam: chạy buổi sáng thì chúng "mới" hơn lần đăng nhập vừa làm. Đặt đồng hồ trang
  // về cuối ngày (vẫn trôi) để thứ tự không phụ thuộc giờ chạy test.
  await page.clock.install({ time: new Date(`${vnToday()}T23:30:00+07:00`) })
  await login('/chuyen', 'dispatcher')
  await page.evaluate(async ({ db }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    await getMockDb().cancelTrip('TRIP-012', 'Khách đổi lịch nhận hàng')
  }, { db: MOCK_DB })

  await signOutFromMenu(page, 'Nguyễn Thanh Tùng')
  await signIn(page, DEMO_EMAILS.systemAdmin, DEMO_PASSWORD)
  await page.waitForURL(/\/nguoi-dung$/)
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Nhật ký', exact: true }).click()
  await page.waitForURL(/\/nhat-ky$/)
  await expect(page.getByRole('heading', { name: 'Nhật ký hệ thống', exact: true })).toBeVisible()

  // Mới nhất trước: quản trị đăng nhập, điều phối đăng xuất, rồi lần huỷ chuyến
  const cancelled = ['Nguyễn Thanh Tùng Điều phối viên', 'Huỷ chuyến', 'Tuyến Bình Chánh – Biên Hoà TRIP-012', 'Lý do: Khách đổi lịch nhận hàng']
  await expect(page.locator('tbody tr').first()).toContainText('Võ Minh Khoa')
  expect(await rowCells(page, 0)).toStrictEqual(['Võ Minh Khoa Quản trị hệ thống', 'Đăng nhập', 'Võ Minh Khoa US-0005', ''])
  expect(await rowCells(page, 1)).toStrictEqual(['Nguyễn Thanh Tùng Điều phối viên', 'Đăng xuất', 'Nguyễn Thanh Tùng US-0001', ''])
  expect(await rowCells(page, 2)).toStrictEqual(cancelled)
  // Ba ô tóm tắt (V2): lần ghi gần nhất là lần quản trị vừa đăng nhập — cùng giờ với dòng đầu bảng (giờ theo múi giờ máy)
  const [latestTime] = (await readableTexts(page.locator('tbody tr').first().locator('td'))).map((text) => text.split(' ')[0])
  await expect(page.getByRole('group', { name: 'Ghi nhận gần nhất', exact: true })).toContainText(latestTime!)

  await page.getByRole('combobox', { name: 'Người làm', exact: true }).click()
  await page.getByRole('option', { name: 'Nguyễn Thanh Tùng', exact: true }).click()
  await expect(page).toHaveURL(/\/nhat-ky\?nguoi-lam=US-0001$/)
  await expect(page.locator('tbody tr').first()).toContainText('Đăng xuất')
  const actors = await readableTexts(page.locator('tbody tr td:nth-child(2)'))
  expect(new Set(actors)).toStrictEqual(new Set(['Nguyễn Thanh Tùng Điều phối viên']))
  expect(await rowCells(page, 1)).toStrictEqual(cancelled)

  // Nhóm "Chuyến": lần huỷ đứng đầu. Quản trị hệ thống không xem được chuyến nên tên chuyến không phải liên kết (không dẫn tới 403)
  await page.getByRole('combobox', { name: 'Nhóm hành động', exact: true }).click()
  await page.getByRole('option', { name: 'Chuyến', exact: true }).click()
  await expect(page.locator('tbody tr').first()).toContainText('Huỷ chuyến')
  expect(await rowCells(page, 0)).toStrictEqual(cancelled)
  await expect(page.locator('tbody tr').first().getByText('Tuyến Bình Chánh – Biên Hoà', { exact: true })).toBeVisible()
  await expect(page.locator('tbody').getByRole('link')).toHaveCount(0)

  // Lọc theo công ty (FE-0-08): chuyến của Long Bình không nằm trong nhật ký của Phương Nam
  const company = page.getByRole('combobox', { name: 'Công ty', exact: true })
  await company.click()
  await page.getByRole('option', { name: 'Công ty CP Giao nhận Phương Nam', exact: true }).click()
  await expect(page).toHaveURL(/cong-ty=LOG-002/)
  await expect(page.locator('tbody tr').first()).not.toContainText('Huỷ chuyến')
  await expect(page.locator('tbody').getByText('Nguyễn Thanh Tùng')).toHaveCount(0)
  await company.click()
  await page.getByRole('option', { name: 'Công ty TNHH Vận tải Long Bình', exact: true }).click()
  await expect(page).toHaveURL(/cong-ty=LOG-001/)
  await expect(page.locator('tbody tr').first()).toContainText('Huỷ chuyến')
  await company.click()
  await page.getByRole('option', { name: 'Mọi công ty', exact: true }).click()
  await expect(page).not.toHaveURL(/cong-ty=/)

  // Nhóm "Đăng nhập": đối tượng là người dùng — màn quản trị hệ thống mở được — nên vẫn là liên kết, mở danh sách lọc đúng người đó
  await page.getByRole('combobox', { name: 'Nhóm hành động', exact: true }).click()
  await page.getByRole('option', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.locator('tbody tr').first()).toContainText('Đăng xuất')
  await page.locator('tbody tr').first().getByRole('link', { name: 'Nguyễn Thanh Tùng', exact: true }).click()
  await page.waitForURL(/\/nguoi-dung\?q=US-0001$/)
  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.getByRole('row', { name: /Nguyễn Thanh Tùng/ })).toContainText('dieuphoi@loadmaster.vn')

  // Quản trị công ty của Long Bình đọc nhật ký của công ty mình: lần mình đăng nhập, điều phối đăng xuất, lần huỷ chuyến. Hai lần quản
  // trị hệ thống đăng nhập, đăng xuất là việc trên tài khoản nền tảng — không có trong nhật ký của công ty; không có bộ lọc công ty
  await signOutFromMenu(page, 'Võ Minh Khoa')
  await signIn(page, DEMO_EMAILS.companyAdmin, DEMO_PASSWORD)
  await page.waitForURL(/\/nguoi-dung$/)
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('link', { name: 'Nhật ký', exact: true }).click()
  await page.waitForURL(/\/nhat-ky$/)
  await expect(page.locator('tbody tr').first()).toContainText('Dương Thị Kim Oanh')
  expect(await rowCells(page, 0)).toStrictEqual(['Dương Thị Kim Oanh Quản trị công ty', 'Đăng nhập', 'Dương Thị Kim Oanh US-LB-01', ''])
  expect(await rowCells(page, 1)).toStrictEqual(['Nguyễn Thanh Tùng Điều phối viên', 'Đăng xuất', 'Nguyễn Thanh Tùng US-0001', ''])
  expect(await rowCells(page, 2)).toStrictEqual(cancelled)
  await expect(page.getByRole('combobox', { name: 'Công ty', exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Nhóm hành động', exact: true }).click()
  await page.getByRole('option', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).toHaveURL(/nhom=auth/)
  await expect(page.locator('tbody tr').first()).toContainText('Đăng nhập')
  expect((await readableTexts(page.locator('tbody tr td:nth-child(2)'))).filter((actor) => actor.startsWith('Võ Minh Khoa'))).toStrictEqual([])
  expect(browserErrors).toStrictEqual([])
})
