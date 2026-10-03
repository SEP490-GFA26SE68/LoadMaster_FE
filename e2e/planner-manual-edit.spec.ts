import type { Page } from '@playwright/test'
import { expect, PLANNER_ROUTE, test } from './fixtures'
import { R3F_DEPS, type R3FModule } from './viewer-helpers'

/**
 * Chỉnh tay trong Planner (LM-108; FE-0-07): điều phối viên kéo / nhích kiện, trọng lực làm kiện đang tựa lên kiện bị kéo đi rơi xuống,
 * và "Duyệt bản chỉnh" duyệt luôn bản đã chỉnh thành revision đã duyệt mới — không còn bước "Lưu bản chỉnh" chờ quản lý công ty.
 * Chồng kiện của chuyến mẫu, trong vùng điểm giao 1 sát cửa (FE-5b-02): `PKG-001-01` nằm sàn (dài 60 cm, cao 50 cm), `PKG-001-15` tựa lên
 * nó ở z = 50, trên nữa là hai kiện; phía cửa còn trống 117,6 cm.
 */
const BOTTOM = 'PKG-001-01'
const TOP = 'PKG-001-15'
const MOCK_DB = '/src/lib/mock-db/index.ts'

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const status = (page: Page) => page.locator('[data-editor-status]')

async function select(page: Page, id: string) {
  const picker = page.getByRole('combobox', { name: 'Chọn kiện', exact: true })
  await picker.selectOption(id)
  await expect(picker).toHaveValue(id)
}

test('the dispatcher edits by hand: pulling the bottom package out drops the one on top, undo lifts it back, "Approve edits" approves the edited plan', async ({ page, login, browserErrors }) => {
  test.setTimeout(3 * 60_000)
  await login(PLANNER_ROUTE, 'dispatcher')
  await page.locator('canvas').waitFor()
  // Bản đã duyệt không có nút chính nào cho tới khi dời kiện
  await button(page, 'Chỉnh sửa').click()
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

  // Đã dời kiện: nút chính là "Duyệt bản chỉnh" — duyệt luôn bản chỉnh tay, không có bước lưu riêng chờ người khác duyệt
  await expect(button(page, 'Lưu bản chỉnh')).toHaveCount(0)
  await button(page, 'Duyệt bản chỉnh').click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  // Bản duyệt nhận cả kiện vừa nhích lẫn các kiện rơi theo trọng lực: kiện nằm trên nó và hai kiện tựa trên kiện đó (rơi dây chuyền)
  await expect(dialog).toContainText('Có 4 kiện chỉnh tay sẽ được áp vào bản duyệt.')
  for (const id of [BOTTOM, TOP]) await expect(dialog, id).toContainText(id)
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click()
  await expect(page).toHaveURL(/\/phuong-an\?revision=REV-\d+/)
  const approvedId = new URL(page.url()).searchParams.get('revision')
  await expect(page.locator('header').first()).toContainText(/Duyệt bởi Nguyễn Thanh Tùng lúc\s*\d{2}:\d{2} \d{2}\/\d{2}/)
  await expect(page.locator('[data-planner-lock]')).toHaveCount(0)
  // Kho: bản mới nhất của chuyến là bản đã duyệt mang chỉnh tay, người duyệt là điều phối viên
  const newest = await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    return (await getMockDb().listRevisions(tripId)).at(-1)
  }, { url: MOCK_DB, tripId: 'TRIP-2026-0914' })
  expect(newest?.id).toBe(approvedId)
  expect([newest?.manuallyEdited, newest?.approvedAt !== undefined, newest?.approvedBy, newest?.draftPatches?.length]).toStrictEqual([true, true, 'US-0001', 4])
  expect(browserErrors).toStrictEqual([])
})

/** Điểm trên màn của vùng nắm một mũi tên trục, dời thêm `deltaCm` theo trục cảnh. */
function handlePoint(page: Page, axis: 'x' | 'y' | 'z', deltaCm: [number, number, number] = [0, 0, 0]) {
  return page.evaluate(async ({ url, name, delta }) => {
    const { _roots } = (await import(url)) as R3FModule
    const canvas = document.querySelector('canvas')!
    const s = _roots.get(canvas)!.store.getState()
    const handle = s.scene.getObjectByName(name)!
    const position = handle.getWorldPosition(handle.position.clone())
    position.x += delta[0] / 100
    position.y += delta[2] / 100
    position.z += delta[1] / 100
    position.project(s.camera)
    const r = canvas.getBoundingClientRect()
    return { x: r.x + (position.x + 1) * r.width / 2, y: r.y + (1 - position.y) * r.height / 2 }
  }, { url: R3F_DEPS, name: `editor-axis-${axis}`, delta: deltaCm })
}

test('grabbing the Z arrow lifts the package straight up only, and dragging it back down snaps it home (LM-108)', async ({ page, login, browserErrors }) => {
  test.setTimeout(3 * 60_000)
  await login(PLANNER_ROUTE, 'dispatcher')
  await page.locator('canvas').waitFor()
  await button(page, 'Chỉnh sửa').click()
  // PKG-004-13: nóc ở 200 cm, phía trên trống tới trần 240 cm, không kiện nào tựa lên nó (nâng lên không kéo theo kiện khác)
  await select(page, 'PKG-004-13')
  const home = await status(page).evaluate((el) => [Number(el.dataset.x), Number(el.dataset.y), Number(el.dataset.z)])

  async function dragArrow(deltaZcm: number) {
    const start = await handlePoint(page, 'z'), end = await handlePoint(page, 'z', [0, 0, deltaZcm])
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await expect(status(page)).toHaveAttribute('data-dragging', 'true')
    await page.mouse.move(end.x, end.y, { steps: 16 })
    await page.mouse.up()
    await expect(status(page)).toHaveAttribute('data-dragging', 'false')
    return status(page).evaluate((el) => [Number(el.dataset.x), Number(el.dataset.y), Number(el.dataset.z)])
  }

  // Kéo mũi tên Z lên khoảng 25 cm: chỉ z đổi, x và y đứng yên (kiện lơ lửng là cảnh báo đỡ đáy, vẫn đặt được)
  const lifted = await dragArrow(25)
  expect(lifted[2]! - home[2]!).toBeGreaterThan(15)
  expect([lifted[0], lifted[1]]).toStrictEqual([home[0], home[1]])
  // Hạ xuống gần chỗ cũ (còn cao hơn vài cm): hút đúng vị trí gốc
  const back = await dragArrow(home[2]! - lifted[2]! + 4)
  expect(back).toStrictEqual(home)
  expect(browserErrors).toStrictEqual([])
})
