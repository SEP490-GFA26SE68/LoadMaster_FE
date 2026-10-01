import type { Page } from '@playwright/test'
import { attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import { enterEdit, selectPlacement, SOURCE_MODULES } from './viewer-helpers'

/**
 * Planner gọn (LM-094, D-51): từ 1.366 px thanh trên là hàng điều khiển duy nhất; bản đã duyệt không có nút Duyệt mà có
 * "Đã duyệt lúc …"; chỉnh một kiện thì có "Duyệt bản chỉnh"; chuyến đã sang pha vận hành hoặc người xem chỉ đọc thì không
 * Chỉnh sửa, không Duyệt và nói lý do một lần; tablet giữ hai hàng 56 px. Lý do chặn Duyệt (tooltip của nút): plan-approval.spec.ts.
 */
test.use({ collectConsoleErrors: true })

/** "Duyệt bởi <tên> lúc …" khi kho biết người duyệt, "Đã duyệt lúc …" khi không. */
const APPROVED_AT = /(Đã duyệt|Duyệt bởi .+) lúc\s*\d{2}:\d{2} \d{2}\/\d{2}/
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const header = (page: Page) => page.locator('header').first()

/** Chữ tràn trong thanh trên (bỏ qua chữ cố ý cắt bằng dấu ba chấm và `sr-only`), và mã chuyến xuống dòng. */
function headerOverflow(page: Page) {
  return header(page).evaluate((root) => {
    const clipped: string[] = []
    if (root.scrollWidth > root.clientWidth + 1) clipped.push(`header ${root.scrollWidth} > ${root.clientWidth}`)
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      if (!element.offsetParent || element.closest('.sr-only')) continue
      if (getComputedStyle(element).textOverflow === 'ellipsis') continue
      if (element.scrollWidth > element.clientWidth + 1) clipped.push(`${element.tagName.toLowerCase()}: ${element.innerText.slice(0, 40)}`)
    }
    const title = root.querySelector('h1')
    if (title && title.getBoundingClientRect().height > 24) clipped.push(`h1 wraps: ${title.textContent}`)
    return clipped
  })
}

/** Một hàng: điều khiển mô phỏng nằm trong thanh trên, thanh công cụ riêng ẩn, không gì tràn. */
async function expectOneRow(page: Page, width: number) {
  await page.setViewportSize({ width, height: width === 1366 ? 768 : 1000 })
  await expect(page.locator('[data-workspace-toolbar]')).toBeHidden()
  await expect(header(page).getByRole('combobox', { name: 'Góc nhìn', exact: true })).toBeVisible()
  await expect(header(page).getByRole('combobox', { name: 'Tập trung điểm giao', exact: true })).toBeVisible()
  expect((await header(page).boundingBox())!.height).toBe(56)
  expect(await headerOverflow(page), `header at ${width} px`).toStrictEqual([])
}

/** Kiện trên cùng (không kiện nào đè lên) của bản seed đã duyệt, gần cửa trước — ứng viên dời 1 cm hợp lệ. */
function topPackagesNearDoor(page: Page) {
  return page.evaluate(async (url) => {
    const { seedScene } = (await import(url)) as typeof import('@/test/scene')
    const { placements } = await seedScene()
    const overlaps = (a: number, al: number, b: number, bl: number) => a < b + bl && b < a + al
    return placements
      .filter((p) => !placements.some((q) => q.id !== p.id && q.position.z === p.position.z + p.heightCm
        && overlaps(p.position.x, p.lengthCm, q.position.x, q.lengthCm) && overlaps(p.position.y, p.widthCm, q.position.y, q.widthCm)))
      .toSorted((a, b) => b.position.x + b.lengthCm - (a.position.x + a.lengthCm))
      .map((p) => p.id)
  }, SOURCE_MODULES.scene)
}

/**
 * Dời một kiện 1 cm bằng nút nudge; constraint engine của editor quyết định hợp lệ (lệnh bị chặn không đổi vị trí). Thử lần lượt
 * các kiện trên cùng gần cửa và bốn hướng tới khi một lệnh được ghi nhận.
 */
async function nudgeOnePackage(page: Page) {
  const status = page.locator('[data-editor-status]')
  const position = () => status.evaluate((el) => `${el.dataset.x}/${el.dataset.y}/${el.dataset.z}`)
  for (const id of (await topPackagesNearDoor(page)).slice(0, 10)) {
    await selectPlacement(page, id)
    for (const nudge of ['Tăng X', 'Giảm X', 'Tăng Y', 'Giảm Y']) {
      const before = await position()
      await button(page, nudge).click()
      if (await position() !== before) return id
    }
  }
  throw new Error('no package of the seed plan could move by 1 cm')
}

test('an approved plan shows when it was approved; one edited package turns it into "Duyệt bản chỉnh"', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await login(PLANNER_ROUTE, 'dispatcher')
  await page.locator('canvas').waitFor()

  await expect(header(page)).toContainText(APPROVED_AT)
  await expect(button(page, 'Duyệt phương án')).toHaveCount(0)
  await expect(button(page, 'Duyệt bản chỉnh')).toHaveCount(0)
  await expectOneRow(page, 1366)
  await attachScreenshot(page, testInfo, 'planner-approved-1366')
  await expectOneRow(page, 1600)
  // 1.680 px: tiêu đề đổi sang tên tuyến; nhãn "Duyệt bởi <tên> lúc" không được lấy chỗ của nó (FE-0-07)
  await expectOneRow(page, 1680)
  await expect(page.getByRole('heading', { level: 1, name: 'Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên Hoà', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 1366, height: 768 })

  await enterEdit(page)
  await nudgeOnePackage(page)
  await expect(button(page, 'Hoàn tác')).toBeEnabled()
  await button(page, 'Xem').click()

  const approveEdits = button(page, 'Duyệt bản chỉnh')
  await expect(approveEdits).toBeVisible()
  await expect(header(page)).not.toContainText(APPROVED_AT)
  await expectOneRow(page, 1366)
  await attachScreenshot(page, testInfo, 'planner-draft-1366')

  await approveEdits.click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await expect(dialog).toContainText('Có 1 kiện chỉnh tay sẽ được áp vào bản duyệt.')
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click()
  await expect(page.getByText('Đã duyệt phương án.')).toBeVisible()
  await page.waitForURL(/\/phuong-an\?revision=REV-/)
  // Bản vừa duyệt mang chỉnh tay: nhãn "Đã chỉnh tay" cùng "Đã duyệt lúc …", vẫn một hàng ở 1.366 px
  await expect(header(page)).toContainText('Đã chỉnh tay')
  await expect(header(page)).toContainText(APPROVED_AT)
  await expect(approveEdits).toHaveCount(0)
  await expectOneRow(page, 1366)
  await attachScreenshot(page, testInfo, 'planner-approved-edited-1366')
  // 1.536 px: nhãn "Đã chỉnh tay" hiện cạnh MOCK RESULT và vẫn nằm trong khối tiêu đề, không đè lên chỉ số (FE-0-07)
  await expectOneRow(page, 1536)
  await expect(header(page).getByText('Đã chỉnh tay', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})

test('a plan awaiting approval keeps "Duyệt phương án" on the one control row', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  // Seed TRIP-012: đã tối ưu, chưa duyệt
  await login('/chuyen/TRIP-012/phuong-an', 'dispatcher')
  await page.locator('canvas').waitFor()

  await expect(button(page, 'Duyệt phương án')).toBeVisible()
  await expect(header(page)).not.toContainText(APPROVED_AT)
  await expectOneRow(page, 1366)
  await attachScreenshot(page, testInfo, 'planner-pending-1366')
  await expectOneRow(page, 1600)
  await expectOneRow(page, 1760)
  expect(browserErrors).toStrictEqual([])
})

test('a trip being loaded opens its plan locked: no Edit, no Approve, one reason with the warehouse progress (V2.3)', async ({ page, login, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await login('/chuyen/TRIP-011/phuong-an')
  await page.locator('canvas').waitFor()

  // V2.3 Planner3DKhoa: lý do khoá, câu giải thích và dòng tiến độ kho lấy từ kho (seed TRIP-011: 110 / 280 kiện)
  const lock = page.locator('[data-planner-lock="loading"]')
  await expect(lock).toContainText('Chuyến đang xếp hàng — phương án đã chốt. Kho đang xếp hàng theo phương án đã duyệt')
  await expect(lock).toContainText(/Kho đã xếp 110 \/ 280 kiện · bắt đầu \d{2}:\d{2} · \d{2}\/\d{2}/)
  for (const name of ['Chỉnh sửa', 'Chỉnh sửa kiện', 'Duyệt phương án', 'Duyệt bản chỉnh']) {
    await expect(button(page, name), name).toHaveCount(0)
  }
  await expect(header(page)).toContainText(APPROVED_AT)
  await expectOneRow(page, 1366)
  await attachScreenshot(page, testInfo, 'planner-locked-1366')
  expect(browserErrors).toStrictEqual([])
})

test('tablet keeps two 56 px control rows; the company manager reads the plan with one reason and no actions (FE-0-07)', { tag: '@tablet' }, async ({ page, login, browserErrors }, testInfo) => {
  await login(PLANNER_ROUTE, 'manager')
  await page.locator('canvas').waitFor()
  const toolbar = page.locator('[data-workspace-toolbar]')
  await expect(toolbar).toBeVisible()
  expect((await toolbar.getByRole('combobox', { name: 'Góc nhìn', exact: true }).boundingBox())!.height).toBe(56)
  expect((await header(page).boundingBox())!.height).toBe(56)
  // Quản lý công ty không có quyền chỉnh sửa và duyệt phương án: một dòng lý do, không nút Chỉnh sửa, không nút Duyệt
  await expect(page.locator('[data-planner-lock="readOnly"]')).toHaveText('Chỉ xem: chỉ điều phối viên chỉnh sửa và duyệt phương án.')
  for (const name of ['Chỉnh sửa', 'Chỉnh sửa kiện', 'Duyệt phương án', 'Duyệt bản chỉnh']) {
    await expect(button(page, name), name).toHaveCount(0)
  }
  await expect(header(page)).toContainText(APPROVED_AT)
  expect(await headerOverflow(page), 'tablet header').toStrictEqual([])
  await attachScreenshot(page, testInfo, 'planner-manager-tablet')
  expect(browserErrors).toStrictEqual([])
})
