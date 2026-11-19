import type { Page } from '@playwright/test'
import { attachJson, expect, test } from './fixtures'

/**
 * "Thử với hàng của bạn" (`#thu-ngay`) của trang giới thiệu, trong trình duyệt thật: bấm "Tính ba phương án" với số mặc định thì bộ tối ưu
 * mô phỏng chạy trên trình duyệt (Web Worker) và ba phương án A · B · C hiện cạnh nhau, không nhãn MOCK RESULT, không lỗi nào trong
 * console; ở 1.440 × 900 form và kết quả gọn trong khoảng một màn hình; điện thoại 390 px không cuộn ngang, ô và nút cao 56 px.
 */
test.use({ collectConsoleErrors: true })

const SECTION = '#thu-ngay'
const RUN = 'Tính ba phương án'

/** Trang cuộn ngang được không (bề rộng tài liệu vượt khung nhìn quá 1 px). */
function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

/** Mở phần "Thử với hàng của bạn", bấm chạy và chờ ba phương án. */
async function runDefaults(page: Page) {
  await page.goto(`/gioi-thieu${SECTION}`)
  const section = page.locator(SECTION)
  await section.getByRole('button', { name: RUN, exact: true }).click()
  await expect(section.locator('[data-try-state]')).toHaveAttribute('data-try-state', 'done', { timeout: 30_000 })
  return section
}

test.describe('landing trial at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the default run gives three plans side by side, without a MOCK RESULT tag and without browser errors', async ({ page, browserErrors }, testInfo) => {
    const section = await runDefaults(page)
    const plans = ['A', 'B', 'C'].map((label) => section.getByRole('group', { name: `Phương án ${label}`, exact: true }))
    for (const plan of plans) {
      await expect(plan).toBeVisible()
      await expect(plan.getByText('120 / 120', { exact: true }).first()).toBeVisible()
    }
    await expect(section).not.toContainText('MOCK RESULT')
    await expect(section.getByText(/Số do bộ tối ưu mô phỏng của LoadMaster chạy trên trình duyệt của bạn tính/)).toBeVisible()

    // Ba thẻ cùng một hàng
    const tops = await Promise.all(plans.map(async (plan) => (await plan.boundingBox())?.y ?? Number.NaN))
    expect(new Set(tops.map((top) => Math.round(top))).size).toBe(1)

    // Form và kết quả gọn trong khoảng một màn hình
    const form = await section.getByRole('form').boundingBox()
    const next = await section.getByRole('link', { name: 'Nhận tư vấn cho hàng của bạn', exact: true }).boundingBox()
    const height = next && form ? next.y + next.height - form.y : Number.NaN
    await attachJson(testInfo, 'landing-try-height', { height })
    expect(height).toBeLessThanOrEqual(900)
    expect(await scrollsSideways(page)).toBe(false)
    expect(browserErrors).toStrictEqual([])
  })
})

test('@phone at 390 px the trial never scrolls sideways and its fields and buttons are 56 px tall', async ({ page, browserErrors }) => {
  const section = await runDefaults(page)
  await expect(section.getByRole('group', { name: 'Phương án C', exact: true })).toBeVisible()
  expect(await scrollsSideways(page)).toBe(false)

  const heights = await section.locator('input, button').evaluateAll((controls) =>
    controls.filter((control) => control.getClientRects().length > 0).map((control) => control.getBoundingClientRect().height))
  expect(heights.length).toBeGreaterThan(8)
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(56)
  await expect(section).not.toContainText('MOCK RESULT')
  expect(browserErrors).toStrictEqual([])
})
