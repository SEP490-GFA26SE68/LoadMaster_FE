import { expect, test } from './fixtures'

/**
 * Hai trang pháp lý công khai trong trình duyệt thật: vừa khung ở điện thoại 390 px và máy bàn 1.440 px (không cuộn ngang), mục lục dính
 * từ 1.024 px đưa tới neo và focus tiêu đề mục, mục lục thu gọn trên điện thoại mở bằng bàn phím, và bộ chuyển giữa hai tài liệu.
 */
test.use({ collectConsoleErrors: true })

const PAGES = [
  { path: '/chinh-sach-bao-mat', title: 'Chính sách bảo mật', section: 'Quyền của bạn', anchor: 'quyen-cua-ban' },
  { path: '/dieu-khoan-su-dung', title: 'Điều khoản sử dụng', section: 'Giới hạn trách nhiệm', anchor: 'gioi-han-trach-nhiem' },
] as const

for (const { path, title, section, anchor } of PAGES) {
  test(`${path}: the sticky contents jumps to a section and focuses its heading on a 1,440 px screen`, async ({ page, browserErrors }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    await expect(page).toHaveTitle(new RegExp(title))
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

    const toc = page.getByRole('navigation', { name: 'Mục lục' }).filter({ visible: true })
    await expect(toc).toHaveCount(1)
    await toc.getByRole('link', { name: section }).click()
    await expect(page).toHaveURL(new RegExp(`${path}#${anchor}$`))
    await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeFocused()
    await expect(toc.getByRole('link', { name: section })).toHaveAttribute('aria-current', 'location')
    // Mục lục vẫn trong khung nhìn sau khi cuộn
    await expect(toc).toBeInViewport()
    expect(browserErrors).toStrictEqual([])
  })

  test(`${path}: fits a 390 px phone and the collapsed contents opens from the keyboard`, async ({ page, browserErrors }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

    const disclosure = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Mục lục' }) })
    await disclosure.locator('summary').focus()
    await page.keyboard.press('Enter')
    await expect(disclosure).toHaveAttribute('open')
    const toc = page.getByRole('navigation', { name: 'Mục lục' }).filter({ visible: true })
    await toc.getByRole('link', { name: section }).click()
    await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeFocused()
    // Chọn một mục thì mục lục thu gọn lại
    await expect(disclosure).not.toHaveAttribute('open')
    expect(browserErrors).toStrictEqual([])
  })
}

test('the document switch moves between the two pages and keeps the language', async ({ page, browserErrors }) => {
  await page.goto('/chinh-sach-bao-mat?lang=en')
  const docs = page.getByRole('navigation', { name: 'Terms and policies' })
  await expect(docs.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('aria-current', 'page')
  await docs.getByRole('link', { name: 'Terms of use' }).click()
  await expect(page).toHaveURL(/\/dieu-khoan-su-dung\?lang=en$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use', exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
