import type { Page } from '@playwright/test'
import { expect, PLANNER_ROUTE, test } from './fixtures'

/**
 * Chỉnh tay trong Planner (LM-108): điều phối viên kéo / nhích kiện được như Planner trước LM-104, trọng lực làm kiện đang tựa lên kiện
 * bị kéo đi rơi xuống, và "Lưu bản chỉnh" gửi bản mới vào hàng đợi duyệt của quản lý công ty.
 * Chồng kiện của chuyến mẫu: `PKG-001-16` nằm sàn (dài 60 cm, cao 50 cm), `PKG-001-05` tựa lên nó ở z = 50; phía cửa còn trống 130 cm.
 */
const BOTTOM = 'PKG-001-16'
const TOP = 'PKG-001-05'
const MOCK_DB = '/src/lib/mock-db/index.ts'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const status = (page: Page) => page.locator('[data-editor-status]')

async function select(page: Page, id: string) {
  const picker = page.getByRole('combobox', { name: 'Chọn kiện', exact: true })
  await picker.selectOption(id)
  await expect(picker).toHaveValue(id)
}

test('the dispatcher edits by hand: pulling the bottom package out drops the one on top, undo lifts it back, "Save edits" queues it for the manager', async ({ page, login, browserErrors }) => {
  test.setTimeout(3 * 60_000)
  await login(PLANNER_ROUTE, 'dispatcher')
  await page.locator('canvas').waitFor()
  // Điều phối viên có lại Chỉnh sửa; bản đã duyệt không có nút chính nào cho tới khi dời kiện
  await button(page, 'Chỉnh sửa').click()
  await expect(button(page, 'Lưu bản chỉnh')).toHaveCount(0)
  await expect(button(page, 'Duyệt bản chỉnh')).toHaveCount(0)

  await select(page, TOP)
  await expect(status(page)).toHaveAttribute('data-z', '50')
  await select(page, BOTTOM)
  await page.getByRole('group', { name: 'Bước dịch chuyển', exact: true }).getByRole('button', { name: '10 cm' }).click()
  // Nhích kiện dưới ra phía cửa từng 10 cm: tới 60 cm thì hết chồng dưới kiện trên (dài 60 cm) và kiện trên rơi xuống sàn
  for (let i = 0; i < 5; i++) await button(page, 'Tăng X').click()
  await select(page, TOP)
  await expect(status(page), 'still resting on the 10 cm left under it').toHaveAttribute('data-z', '50')
  await select(page, BOTTOM)
  await button(page, 'Tăng X').click()
  await select(page, TOP)
  await expect(status(page)).toHaveAttribute('data-z', '0')

  // Nhích kiện và kiện rơi là một lệnh: hoàn tác một lần thì kiện trên về lại z = 50
  await button(page, 'Hoàn tác').click()
  await expect(status(page)).toHaveAttribute('data-z', '50')
  await button(page, 'Làm lại').click()
  await expect(status(page)).toHaveAttribute('data-z', '0')

  await button(page, 'Lưu bản chỉnh').click()
  await expect(page).toHaveURL(/revision=REV-\d+/)
  const saved = new URL(page.url()).searchParams.get('revision')
  // Bản vừa lưu chưa duyệt: điều phối viên thấy dòng chờ quản lý, và nó đứng trong hàng đợi duyệt
  await expect(page.locator('[data-planner-lock="awaitingApproval"]')).toBeVisible()
  const queued = await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    return (await getMockDb().listReviewQueue()).find((item) => item.tripId === tripId)
  }, { url: MOCK_DB, tripId: 'TRIP-2026-0914' })
  expect(queued?.revisionId).toBe(saved)
  expect(queued?.manuallyEdited).toBe(true)
  expect(browserErrors).toStrictEqual([])
})
