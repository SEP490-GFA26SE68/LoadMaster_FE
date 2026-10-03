import type { Page } from '@playwright/test'
import { attachJson, attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import { closeInspector, hasSceneObject, metrics, openInspector, selectPlacement, settle, SOURCE_MODULES, visibleCargo, waitCameraSettled, waitIdle } from './viewer-helpers'

/**
 * Vùng theo điểm giao trong Planner (FE-5b-07): dải vùng trên sàn và nhãn của từng vùng, bật / tắt ở hộp Hiển thị; hộp Chi tiết có
 * tải trục, dỡ-xếp lại và mức hạn; thẻ kiện có vùng của kiện; kiện nằm ngoài vùng có dấu trong 3D và trong danh sách; số draw call
 * không tăng theo số điểm giao.
 */
test.use({ collectConsoleErrors: true })

const STOP_COUNTS = [1, 4, 8] as const
const TIERS = ['balanced', 'low'] as const
/** Chuyến seed có kiện nằm ngoài vùng: điểm giao 1 cần nhiều sàn hơn vùng chia theo thể tích của nó. */
const REHANDLING_ROUTE = '/chuyen/TRIP-005/phuong-an'

const fixtureRoute = (stops: number, tier: string) => `${PLANNER_ROUTE}?debug&packages=1000&quality=${tier}&stops=${stops}`
const zoneLabels = (page: Page) => page.locator('[data-zone-label]')

async function restingDrawCalls(page: Page) {
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-viewer-performance]')?.dataset.drawCalls) > 0)
  await waitCameraSettled(page)
  await waitIdle(page)
  return Number((await metrics(page)).drawCalls)
}

/** Số kiện nằm ngoài vùng của bản đã duyệt mà Planner mở cho chuyến, đọc từ kho như app đọc. */
function seedOutOfZone(page: Page, tripId: string) {
  return page.evaluate(async ({ url, tripId }) => {
    const { approvedScene } = (await import(url)) as typeof import('@/test/scene')
    const scene = await approvedScene(tripId)
    return { stored: scene.metrics?.rehandlingCount, ids: scene.placements.filter((p) => p.outOfZone).map((p) => p.id), zones: scene.zones.length }
  }, { url: SOURCE_MODULES.scene, tripId })
}

test('zone strips cost the same draw calls with 1, 4 and 8 stops, in the balanced and the low tier', async ({ page, login, browserErrors }, testInfo) => {
  test.slow()
  const drawCalls: Record<string, Record<number, number>> = {}
  let signedIn = false
  for (const tier of TIERS) {
    drawCalls[tier] = {}
    for (const stops of STOP_COUNTS) {
      if (signedIn) await page.goto(fixtureRoute(stops, tier))
      else await login(fixtureRoute(stops, tier))
      signedIn = true
      drawCalls[tier]![stops] = await restingDrawCalls(page)
      expect(await hasSceneObject(page, 'stop-zone-strips'), `${tier} ${stops}`).toBe(true)
      await expect(zoneLabels(page)).toHaveCount(stops)
      expect(drawCalls[tier]![stops], `${tier} ${stops}`).toBeLessThan(100)
    }
  }
  // Tắt dải vùng ở fixture 8 điểm: mất đúng một draw call ở tier có viền chung (vỏ viền vẫn còn cho viền chung)
  await page.goto(fixtureRoute(8, 'balanced'))
  const on = await restingDrawCalls(page)
  const display = await openInspector(page, 'display')
  await display.getByRole('button', { name: 'Ẩn dải vùng điểm giao', exact: true }).click()
  await closeInspector(page)
  await settle(page, 400)
  const off = Number((await metrics(page)).drawCalls)
  await attachJson(testInfo, 'zone-draw-calls', { ...drawCalls, stripOff8Balanced: off })

  expect(new Set(STOP_COUNTS.map((stops) => drawCalls.balanced![stops])).size, JSON.stringify(drawCalls)).toBe(1)
  // Tier low không có viền chung: vỏ viền chỉ có khi phương án có kiện ngoài vùng. Fixture 1 điểm không có kiện nào như vậy.
  expect(drawCalls.low![8]).toBe(drawCalls.low![4])
  expect(drawCalls.low![4]! - drawCalls.low![1]!).toBeLessThanOrEqual(1)
  expect(on - off).toBe(1)
  expect(browserErrors).toStrictEqual([])
})

test('the seed plan shows a strip and a label per stop zone; the Display box turns them off and on', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${PLANNER_ROUTE}?debug&quality=balanced`)
  await restingDrawCalls(page)
  const seed = await seedOutOfZone(page, 'TRIP-2026-0914')
  expect(seed).toStrictEqual({ stored: 0, ids: [], zones: 4 })
  expect(await hasSceneObject(page, 'stop-zone-strips')).toBe(true)
  await expect(zoneLabels(page)).toHaveCount(4)
  // Nhãn: số điểm, tên điểm, tỷ lệ thể tích hàng của điểm đó
  for (const label of await zoneLabels(page).all()) await expect(label).toHaveText(/^\dVùng điểm \d.+\d+,\d%$/)
  await attachScreenshot(page, testInfo, 'zones-seed-plan', { style: '[data-viewer-performance] { visibility: hidden !important; }' })

  const display = await openInspector(page, 'display')
  const hide = display.getByRole('button', { name: 'Ẩn dải vùng điểm giao', exact: true })
  await expect(hide).toHaveAttribute('aria-pressed', 'true')
  await hide.click()
  await expect(zoneLabels(page)).toHaveCount(0)
  expect(await hasSceneObject(page, 'stop-zones')).toBe(false)
  await display.getByRole('button', { name: 'Hiện dải vùng điểm giao', exact: true }).click()
  await expect(zoneLabels(page)).toHaveCount(4)

  // Hộp Chi tiết: tải trục, dỡ-xếp lại, mức hạn
  const details = await openInspector(page, 'operations')
  await expect(details.getByRole('region', { name: 'Tải trục', exact: true })).toBeVisible()
  await expect(details.getByRole('region', { name: 'Dỡ-xếp lại', exact: true })).toContainText('Không kiện nào nằm ngoài vùng của điểm giao mình.')
  const deadlines = details.getByRole('region', { name: 'Mức hạn', exact: true })
  await expect(deadlines.getByRole('listitem')).toHaveCount(4)
  await expect(deadlines).toContainText(/Dự kiến đến \d{2}:\d{2} \d{2}\/\d{2}\/\d{4}/)
  const figures = await openInspector(page, 'metrics')
  await expect(figures.getByText('Số lần dỡ-xếp lại', { exact: true })).toBeVisible()
  await closeInspector(page)
  expect(browserErrors).toStrictEqual([])
})

test('packages outside the zone of their stop: counted in Details, marked in the list, in the package card and by an outline that the low tier keeps', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${REHANDLING_ROUTE}?debug&quality=low`)
  await restingDrawCalls(page)
  const seed = await seedOutOfZone(page, 'TRIP-005')
  expect(seed.ids.length).toBeGreaterThan(0)
  expect(seed.stored, 'the stored metric is the number of packages the scene marks').toBe(seed.ids.length)

  // Tier low tắt viền chung nhưng giữ dải vùng và viền của đúng các kiện ngoài vùng
  expect(await hasSceneObject(page, 'stop-zone-strips')).toBe(true)
  expect((await visibleCargo(page))['cargo-hull']).toBe(seed.ids.length)
  await attachScreenshot(page, testInfo, 'zones-out-of-zone-low', { style: '[data-viewer-performance] { visibility: hidden !important; }' })

  const details = await openInspector(page, 'operations')
  await expect(details.getByRole('region', { name: 'Dỡ-xếp lại', exact: true })).toContainText(`${seed.ids.length} kiện nằm ngoài vùng của điểm giao mình`)

  const list = await openInspector(page, 'packages')
  await list.getByRole('checkbox', { name: 'Chỉ kiện nằm ngoài vùng', exact: true }).check()
  await expect(list.getByText(`/ ${seed.ids.length} kiện`)).toBeVisible()
  await closeInspector(page)

  await selectPlacement(page, seed.ids[0]!)
  const card = (await openInspector(page, 'package')).getByRole('complementary', { name: 'Kiện đang chọn', exact: true })
  await expect(card).toContainText('Ngoài vùng')
  await expect(card).toContainText(/Nằm ngoài vùng của điểm \d — tính một lần dỡ-xếp lại\./)
  await closeInspector(page)

  // Tắt dải vùng thì dấu ngoài vùng cũng tắt
  const display = await openInspector(page, 'display')
  await display.getByRole('button', { name: 'Ẩn dải vùng điểm giao', exact: true }).click()
  await closeInspector(page)
  await settle(page, 400)
  expect(await hasSceneObject(page, 'cargo-hull')).toBe(false)
  expect(browserErrors).toStrictEqual([])
})
