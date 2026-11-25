import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

/**
 * Thanh điều hướng chỉ hiện những mục vừa chỗ; mục còn lại nằm trong menu "Thêm" (nút duy nhất của khay). Hai hàm dưới đây cho spec đọc
 * và mở mục mà không phụ thuộc mục đó đang ở khay hay trong menu.
 */

/** Mọi mục điều hướng theo thứ tự: mục trên khay rồi mục trong menu "Thêm" (khi có). */
export async function navLabels(nav: Locator, page: Page): Promise<string[]> {
  const shown = (await nav.getByRole('link').allInnerTexts()).map((label) => label.trim())
  const more = nav.getByRole('button')
  if ((await more.count()) === 0) return shown
  await more.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const hidden = (await menu.getByRole('menuitem').allInnerTexts()).map((label) => label.trim())
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  return [...shown, ...hidden]
}

/** Mở một mục điều hướng: bấm thẳng trên khay, hay qua menu "Thêm" khi mục không vừa khay. */
export async function openNavItem(nav: Locator, page: Page, name: string): Promise<void> {
  const link = nav.getByRole('link', { name, exact: true })
  if ((await link.count()) > 0) {
    await link.click()
    return
  }
  await nav.getByRole('button').click()
  await page.getByRole('menu').getByRole('menuitem', { name, exact: true }).click()
}
