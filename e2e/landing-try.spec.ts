import type { Page } from '@playwright/test'
import { attachJson, expect, test } from './fixtures'

/**
 * "Thử với hàng của bạn" (`#thu-ngay`) của trang giới thiệu, trong trình duyệt thật: bấm "Tính ba phương án" với số mặc định thì bộ tối ưu
 * mô phỏng chạy trên trình duyệt (Web Worker) và ba phương án A · B · C hiện cạnh nhau, không nhãn MOCK RESULT, không lỗi nào trong
 * console; ở 1.440 × 900 cột kết quả gọn trong một màn hình và dính dưới đầu trang — form (ba loại kiện) cao hơn một màn hình, nên bấm nút
 * ở cuối form xong thì cột được cuộn vào, ba phương án nằm trọn trong khung nhìn — cả ở 1.280 × 768, mốc thấp nhất cột còn dính; điện thoại 390 px không cuộn ngang, ô và nút cao 56 px.
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
      await expect(plan.getByText('124 / 124', { exact: true })).toBeVisible()
    }
    await expect(section).not.toContainText('MOCK RESULT')
    await expect(section.getByText(/Số do bộ tối ưu mô phỏng của LoadMaster chạy trên trình duyệt của bạn tính/)).toBeVisible()

    // Ba thẻ cùng một hàng
    const tops = await Promise.all(plans.map(async (plan) => (await plan.boundingBox())?.y ?? Number.NaN))
    expect(new Set(tops.map((top) => Math.round(top))).size).toBe(1)

    // Cột kết quả (tiêu đề → nút đi tiếp) gọn trong một màn hình
    const results = await section.locator('[data-try-state]').boundingBox()
    const form = await section.getByRole('form').boundingBox()
    await attachJson(testInfo, 'landing-try-height', { results: results?.height, form: form?.height })
    expect(results?.height ?? Number.NaN).toBeLessThanOrEqual(900 - 80)
    // Nút chạy nằm cuối form, dưới màn đầu: tính xong thì cột kết quả được cuộn vào, cả ba thẻ nằm trọn trong khung nhìn
    await expect(section.getByRole('button', { name: RUN, exact: true })).toBeInViewport()
    for (const plan of plans) await expect(plan).toBeInViewport({ ratio: 1 })
    expect(await scrollsSideways(page)).toBe(false)
    expect(browserErrors).toStrictEqual([])
  })
})

test.describe('landing trial at 1280 × 768', () => {
  test.use({ viewport: { width: 1280, height: 768 } })

  test('the sticky results column still fits under the header, so the three plans end up fully in view', async ({ page }, testInfo) => {
    const section = await runDefaults(page)
    const results = await section.locator('[data-try-state]').boundingBox()
    await attachJson(testInfo, 'landing-try-height-1280x768', { results: results?.height })
    // 768 − 80 (đầu trang trên máy cảm ứng): cột vừa màn thì còn dính và còn được cuộn vào
    expect(results?.height ?? Number.NaN).toBeLessThanOrEqual(768 - 80)
    for (const label of ['A', 'B', 'C']) {
      await expect(section.getByRole('group', { name: `Phương án ${label}`, exact: true })).toBeInViewport({ ratio: 1 })
    }
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
