import type { Locator, Page } from '@playwright/test'
import { attachScreenshot, expect, test } from './fixtures'

/**
 * Trợ lý "Hỏi Lumo" của trang giới thiệu, trong trình duyệt thật: nút mở không che nút chính của phần mở đầu hay nút "Lên đầu trang", khung
 * chat là thẻ không modal cạnh nút trên máy tính và tờ phủ cả màn trên điện thoại (390 px), trang không cuộn ngang. Ảnh chụp (câu trả lời
 * gói cước và phép tính gói) ghi vào `E2E_SCREENSHOT_DIR` khi có.
 */
type Box = { x: number; y: number; width: number; height: number }

/**
 * Chờ câu trả lời của Lumo: nhịp thật 2–6 giây từ lúc gửi (`assistant-pace.ts`), máy CI chậm cộng thêm — chờ hẳn 20 giây ở đúng các bước
 * này, không tắt nhịp.
 */
const ANSWER = { timeout: 20_000 }

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('Phần tử không hiện trên trang')
  return box
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/** Nút mở không chồng lên điều khiển nào mang `data-assistant-avoid` đang hiện. */
async function expectLauncherClear(page: Page, launcher: Locator) {
  await expect
    .poll(async () => {
      const zone = await boxOf(launcher)
      const avoid = await page.locator('[data-assistant-avoid]').evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }),
      )
      return avoid.filter((box) => box.width > 0 && overlaps(zone, box)).length
    })
    .toBe(0)
}

async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await expect(page.getByRole('button', { name: 'Lên đầu trang' })).toBeInViewport()
}

async function askAdvisor(page: Page, runs: string, plan: string) {
  const panel = page.getByRole('dialog', { name: 'Lumo' })
  await panel.getByRole('textbox', { name: 'Câu hỏi của bạn' }).fill('Gói nào hợp với công ty tôi?')
  await panel.getByRole('textbox', { name: 'Câu hỏi của bạn' }).press('Enter')
  const quick = panel.getByRole('group', { name: 'Chọn nhanh số lần chạy mỗi tháng' })
  await expect(quick).toBeVisible(ANSWER)
  await quick.getByRole('button', { name: runs }).click()
  await expect(panel.getByText(new RegExp(`^Gói rẻ nhất đủ dùng: ${plan} — `))).toBeVisible()
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a passive launcher beside the hero; the panel is a card next to it that leaves the page usable', async ({ page }, testInfo) => {
    await page.goto('/gioi-thieu')
    const launcher = page.getByRole('button', { name: 'Hỏi Lumo' })
    await expect(launcher).toBeVisible()
    await expect(launcher).toHaveText('Hỏi Lumo')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expectLauncherClear(page, launcher)

    await launcher.click()
    const panel = page.getByRole('dialog', { name: 'Lumo' })
    await expect(panel).toBeVisible()
    await expect(panel).not.toHaveAttribute('aria-modal', 'true')
    await expect(panel.getByRole('textbox', { name: 'Câu hỏi của bạn' })).toBeFocused()
    // Thẻ cạnh nút, không quá 380 × 560 px (làm tròn: trình duyệt đo lệch phần nhỏ của pixel), chờ hiệu ứng mở chạy xong
    await expect.poll(async () => {
      const card = await boxOf(panel)
      const top = (await boxOf(launcher)).y
      return [Math.round(card.width) <= 380, Math.round(card.height) <= 560, Math.round(card.y + card.height) <= Math.round(top)]
    }).toStrictEqual([true, true, true])

    await panel.getByRole('button', { name: 'Giá các gói?' }).click()
    await expect(panel.getByText(/^Basic: .+ mỗi tháng/)).toBeVisible(ANSWER)
    await expect(panel.getByRole('link', { name: 'Mở bảng giá' })).toBeVisible()
    await attachScreenshot(page, testInfo, 'assistant-1440-plans')

    await askAdvisor(page, '2.000 lần mỗi tháng', 'Pro')
    await expect(panel.getByText('2.000 lần × 2 credit mỗi lần = 4.000 credit mỗi tháng.')).toBeVisible()
    await attachScreenshot(page, testInfo, 'assistant-1440-advisor')

    // Thẻ không modal: trang phía sau vẫn bấm được; Esc ở trong khung thì đóng và trả focus về nút
    await panel.getByRole('textbox', { name: 'Câu hỏi của bạn' }).press('Escape')
    await expect(panel).toBeHidden()
    await expect(launcher).toBeFocused()

    await scrollToBottom(page)
    await expectLauncherClear(page, launcher)
    expect(await horizontalOverflow(page)).toBe(0)
  })
})

test('@phone the launcher is a 56 px icon clear of the hero CTA and back-to-top; the panel is a full-screen sheet', async ({ page }, testInfo) => {
  await page.goto('/gioi-thieu')
  const launcher = page.getByRole('button', { name: 'Hỏi Lumo' })
  await expect(launcher).toBeVisible()
  const icon = await boxOf(launcher)
  expect(icon.width).toBeLessThanOrEqual(60)
  expect(icon.height).toBeGreaterThanOrEqual(56)
  await expectLauncherClear(page, launcher)
  expect(await horizontalOverflow(page)).toBe(0)

  await scrollToBottom(page)
  await expectLauncherClear(page, launcher)

  await launcher.click()
  const panel = page.getByRole('dialog', { name: 'Lumo' })
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('aria-modal', 'true')
  await expect.poll(async () => boxOf(panel)).toStrictEqual({ x: 0, y: 0, width: 390, height: 844 })
  expect(await horizontalOverflow(page)).toBe(0)

  await askAdvisor(page, '300 lần mỗi tháng', 'Basic')
  await expect(panel.getByText('300 lần × 2 credit mỗi lần = 600 credit mỗi tháng.')).toBeVisible()
  expect(await horizontalOverflow(page)).toBe(0)
  await attachScreenshot(page, testInfo, 'assistant-390-advisor')

  await panel.getByRole('button', { name: 'Đóng trợ lý' }).click()
  await expect(panel).toBeHidden()
  await expect(launcher).toBeFocused()
})
