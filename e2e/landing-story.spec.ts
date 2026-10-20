import type { Locator, Page } from '@playwright/test'
import { attachJson, expect, test } from './fixtures'
import { drawnFrames, R3F_DEPS, waitDemandIdle, type R3FModule } from './viewer-helpers'

/**
 * Khung 3D "Sân kho kể chuyện" của trang giới thiệu, chạy thật trên SwiftShader: phương án mẫu tính ngay trên trình duyệt, chuyện 9 giây
 * chạy một lần tới xếp xong; nút ba trạng thái dừng được cả số trên thẻ chuyến lẫn khung hình; giảm chuyển động cho thấy ngay trạng thái
 * cuối; số của "Con số kiểm được" lăn rồi dừng đúng chuỗi; neo `#lien-he` hiện tiêu đề ngay; điện thoại 390 px không cuộn ngang. Scene R3F
 * đọc qua `_roots` như các suite viewer — trang giới thiệu không có bảng đo của `?debug` (`?debug&quality=` chỉ khoá tier), nên số draw
 * call đọc thẳng từ renderer.
 */
test.use({ collectConsoleErrors: true })

const STAGE = 'figure[data-story-status]'
/** Chuyện dài 9 giây nhưng mỗi khung hình chỉ tiến tối đa 250 ms: SwiftShader vẽ chậm thì chuyện chạy chậm theo. */
const STORY_WAIT_MS = 120_000
/**
 * Trần draw call của khung nghỉ ở góc Toàn cảnh: max(40, cảnh khi chưa có sân kho + 3). Đo ngày 20/10/2026 trên SwiftShader, chuyện đã
 * xong (cả cảnh / khi ẩn sân kho): high 34 / 32, balanced 27 / 25, low 19 / 17 — sân kho tốn đúng 2 ở mọi tier (mặt quét đã tắt).
 */
const DRAW_CALL_CAP = 40
/** Sân kho (`DioramaScene`) thêm tối đa ba draw call: nền gộp, hộp của làn chờ, mặt quét (chỉ trong pha tối ưu). */
const YARD_DRAW_CALLS = 3

/** Số n của "Đang xếp n / 366" trên thẻ chuyến; `null` khi thẻ chưa (hay không còn) ở pha xếp. */
async function loadingCount(page: Page): Promise<number | null> {
  const match = /Đang xếp (\d+) \/ 366/.exec(await page.locator(STAGE).innerText())
  return match ? Number(match[1]) : null
}

/** Chiều cao bố cục (không tính transform của chuyển động hiện ra). */
function layoutHeight(locator: Locator): Promise<number> {
  return locator.evaluate((element) => (element as HTMLElement).offsetHeight)
}

/** Số draw call của khung hình vừa vẽ: renderer đặt lại bộ đếm mỗi lần vẽ. */
function lastDrawCalls(page: Page): Promise<number> {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    return _roots.get(document.querySelector('canvas')!)!.store.getState().gl.info.render.calls
  }, R3F_DEPS)
}

/** Ẩn / hiện cả sân kho (`landing-diorama`) rồi xin một khung hình. */
function showYard(page: Page, visible: boolean): Promise<void> {
  return page.evaluate(async ({ url, visible }) => {
    const { _roots } = (await import(url)) as R3FModule
    const state = _roots.get(document.querySelector('canvas')!)!.store.getState()
    state.scene.getObjectByName('landing-diorama')!.visible = visible
    state.invalidate()
  }, { url: R3F_DEPS, visible })
}

/** Draw call của khung nghỉ: cả cảnh, và khi tạm ẩn sân kho — phần chênh là của riêng sân kho. Hiện lại thì số trở về như cũ. */
async function restingDrawCalls(page: Page) {
  await waitDemandIdle(page, 500)
  const scene = await lastDrawCalls(page)
  await showYard(page, false)
  await waitDemandIdle(page, 500)
  const withoutYard = await lastDrawCalls(page)
  await showYard(page, true)
  await waitDemandIdle(page, 500)
  expect(await lastDrawCalls(page)).toBe(scene)
  return { scene, withoutYard }
}

/** Độ đục thật của tiêu đề và mọi từ tách của nó: tích độ đục của phần tử và các phần tử bao ngoài. */
function shownOpacity(heading: Locator): Promise<number> {
  return heading.evaluate((element) => {
    const effective = (node: Element) => {
      let opacity = 1
      for (let current: Element | null = node; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity)
      return opacity
    }
    return Math.min(...[element, ...element.querySelectorAll('.reveal-word, .reveal-ink')].map(effective))
  })
}

/** Trang cuộn ngang được không (bề rộng tài liệu vượt khung nhìn quá 1 px). */
function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

test.describe('landing story at 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the sample trip plays once to the end: MOCK RESULT and 366 / 366 fill a readout that keeps its height, and the resting overview stays under the draw-call cap', async ({ page, browserErrors }, testInfo) => {
    await page.goto('/gioi-thieu')
    const stage = page.locator(STAGE)
    const readout = stage.locator('[data-stage-readout]')
    await expect(readout).toContainText('Số liệu của lần chạy hiện ra khi xếp xong.')
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    const pendingHeight = await layoutHeight(readout)

    await expect(stage).toHaveAttribute('data-story-status', 'ended', { timeout: STORY_WAIT_MS })
    await expect(readout).toContainText('MOCK RESULT')
    await expect(readout).toContainText('366 / 366')
    await expect(readout).not.toContainText('Số liệu của lần chạy hiện ra khi xếp xong.')
    expect(await layoutHeight(readout)).toBe(pendingHeight)
    await expect(stage.getByText('Xếp xong — chờ xuất phát', { exact: true })).toBeVisible()
    await expect(stage.getByRole('button', { name: 'Xếp lại thùng xe từ đầu', exact: true })).toBeVisible()

    await expect(stage.locator('[data-view]')).toHaveAttribute('data-view', 'overview')
    await expect(page.getByRole('group', { name: 'Góc nhìn', exact: true }).getByRole('button', { name: 'Toàn cảnh', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const drawCalls = await restingDrawCalls(page)
    await attachJson(testInfo, 'landing-draw-calls', drawCalls)
    expect(drawCalls.scene - drawCalls.withoutYard).toBeLessThanOrEqual(YARD_DRAW_CALLS)
    expect(drawCalls.scene).toBeLessThanOrEqual(DRAW_CALL_CAP)
    expect(browserErrors).toStrictEqual([])
  })

  test('in every quality tier the resting overview stays under the draw-call cap and the yard costs at most three draw calls', async ({ page, browserErrors }, testInfo) => {
    // Giảm chuyển động đưa cảnh thẳng về trạng thái cuối; `?debug&quality=` khoá tier như các suite đo của Planner
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const counts: Record<string, { scene: number; withoutYard: number }> = {}
    for (const tier of ['high', 'balanced', 'low'] as const) {
      await page.goto(`/gioi-thieu?debug&quality=${tier}`)
      await expect(page.locator(STAGE)).toHaveAttribute('data-story-status', 'ended', { timeout: STORY_WAIT_MS })
      await expect(page.locator(STAGE).locator('[data-view]')).toHaveAttribute('data-view', 'overview')
      counts[tier] = await restingDrawCalls(page)
    }
    await attachJson(testInfo, 'landing-draw-calls-by-tier', counts)
    for (const [tier, count] of Object.entries(counts)) {
      expect(count.scene - count.withoutYard, tier).toBeLessThanOrEqual(YARD_DRAW_CALLS)
      expect(count.scene, tier).toBeLessThanOrEqual(DRAW_CALL_CAP)
    }
    expect(browserErrors).toStrictEqual([])
  })

  test('pausing while the truck loads freezes the count and the canvas, keeps focus on the button, and resume carries on to the end', async ({ page, browserErrors }) => {
    await page.goto('/gioi-thieu')
    const stage = page.locator(STAGE)
    await expect.poll(() => loadingCount(page), { timeout: STORY_WAIT_MS }).toBeGreaterThan(0)

    await stage.getByRole('button', { name: 'Tạm dừng chuyến mẫu', exact: true }).click()
    await expect(stage).toHaveAttribute('data-story-status', 'paused')
    const resume = stage.getByRole('button', { name: 'Tiếp tục chuyến mẫu', exact: true })
    await expect(resume).toBeFocused()
    // Khung hình đã xin trước cú bấm vẽ nốt; từ đó không vẽ thêm khung nào, số trên thẻ đứng yên
    await waitDemandIdle(page, 300)
    const paused = { count: await loadingCount(page), frame: await drawnFrames(page) }
    expect(paused.count).not.toBeNull()
    expect(paused.count!).toBeLessThan(366)
    await page.waitForTimeout(800)
    expect({ count: await loadingCount(page), frame: await drawnFrames(page) }).toEqual(paused)
    await expect(resume).toBeFocused()

    await resume.click()
    await expect(stage.getByRole('button', { name: 'Tạm dừng chuyến mẫu', exact: true })).toBeFocused()
    await expect.poll(async () => (await stage.getAttribute('data-story-status')) === 'ended' || ((await loadingCount(page)) ?? 0) > paused.count!).toBe(true)
    await expect(stage).toHaveAttribute('data-story-status', 'ended', { timeout: STORY_WAIT_MS })
    await expect(stage.getByRole('button', { name: 'Xếp lại thùng xe từ đầu', exact: true })).toBeFocused()
    await expect(stage.locator('[data-stage-readout]')).toContainText('366 / 366')
    expect(browserErrors).toStrictEqual([])
  })

  test('reduced motion shows the final state at once: no story button, nothing animates', async ({ page, browserErrors }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/gioi-thieu')
    const stage = page.locator(STAGE)
    await expect(stage).toHaveAttribute('data-story-status', 'ended', { timeout: STORY_WAIT_MS })
    await expect(stage.getByText('Xếp xong — chờ xuất phát', { exact: true })).toBeVisible()
    const readout = stage.locator('[data-stage-readout]')
    await expect(readout).toContainText('MOCK RESULT')
    await expect(readout).toContainText('366 / 366')
    await waitDemandIdle(page, 500)
    await expect(stage.getByRole('button', { name: /chuyến mẫu|Xếp lại/ })).toHaveCount(0)
    await expect(page.locator('[data-motion="on"]')).toHaveCount(0)
    expect(browserErrors).toStrictEqual([])
  })

  test('the six checkable figures roll once and stop on exactly their formatted strings', async ({ page, browserErrors }) => {
    await page.goto('/gioi-thieu')
    const facts = page.locator('#con-so')
    const cells = facts.locator('.reveal-odo-cell')
    await expect(page.locator('[data-motion="on"]')).toHaveCount(1)
    // `#con-so` nằm dưới màn hình đầu: mỗi chữ số của sáu chuỗi đã có một ô, chờ cuộn tới mới lăn
    await expect(cells).toHaveCount(8)
    await facts.scrollIntoViewIfNeeded()
    const items = facts.locator('dl > *')
    await expect(items).toHaveCount(6)
    for (const item of await items.all()) await item.scrollIntoViewIfNeeded()
    await expect(cells).toHaveCount(0, { timeout: 10_000 })
    const values = await facts.locator('dl > * > dd:first-of-type').allInnerTexts()
    expect(values.map((value) => value.replace(/[  ]/g, ' ').trim())).toEqual(['6', '3', '0,1 cm', '< 1 giây', '10', '8'])
    expect(browserErrors).toStrictEqual([])
  })

  test('opening the contact anchor focuses its heading, in view and fully shown within 1.5 s', async ({ page, browserErrors }) => {
    await page.goto('/gioi-thieu#lien-he')
    const heading = page.getByRole('heading', { level: 2, name: 'Liên hệ với LoadMaster', exact: true })
    await heading.waitFor({ state: 'attached' })
    await expect(heading).toBeFocused({ timeout: 1_500 })
    await expect(heading).toBeInViewport({ timeout: 1_500 })
    await expect.poll(() => shownOpacity(heading), { timeout: 1_500 }).toBe(1)
    expect(browserErrors).toStrictEqual([])
  })
})

test('@phone at 390 px the page never scrolls sideways, the truck view is the default, and the story ends once the stage is scrolled to', async ({ page, browserErrors }) => {
  await page.goto('/gioi-thieu')
  const stage = page.locator(STAGE)
  await expect(page.getByRole('group', { name: 'Góc nhìn', exact: true }).getByRole('button', { name: 'Thùng xe', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(stage.locator('[data-view]')).toHaveAttribute('data-view', 'truck')
  expect(await scrollsSideways(page)).toBe(false)

  await stage.locator('[data-view]').scrollIntoViewIfNeeded()
  await expect(stage).toHaveAttribute('data-story-status', 'ended', { timeout: STORY_WAIT_MS })
  await expect(stage.locator('[data-stage-readout]')).toContainText('366 / 366')
  expect(await scrollsSideways(page)).toBe(false)
  expect(browserErrors).toStrictEqual([])
})
