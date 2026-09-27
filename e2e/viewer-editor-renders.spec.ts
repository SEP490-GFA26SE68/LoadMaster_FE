import type { Page } from '@playwright/test'
import { attachJson, expect, PLANNER_ROUTE, test } from './fixtures'
import { cameraPreset, proxyPoint, renderCameraChange, waitIdle } from './viewer-helpers'

type CommitWindow = Window & { __lmCommits?: Record<string, number> }

/**
 * Thay React Profiler (LM-035): hook DevTools giả đặt trước khi React nạp, đếm commit của từng renderer (react-dom và R3F).
 * Kéo không được đưa pointer frame qua React: preview cập nhật imperative, panel chỉ nhận snapshot đã giới hạn tần suất.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } })
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as CommitWindow
    const counts: Record<string, number> = {}
    const names = new Map<number, string>()
    let next = 1
    target.__lmCommits = counts
    Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
      configurable: true,
      value: {
        supportsFiber: true,
        renderers: new Map(),
        inject(internals: { rendererPackageName?: string }) {
          const id = next++
          names.set(id, internals.rendererPackageName ?? `renderer-${id}`)
          return id
        },
        onCommitFiberRoot(id: number) {
          const name = names.get(id) ?? `renderer-${id}`
          counts[name] = (counts[name] ?? 0) + 1
        },
        onCommitFiberUnmount() {},
        onPostCommitFiberRoot() {},
        checkDCE() {},
      },
    })
  })
})

const commits = (page: Page) => page.evaluate(() => ({ ...(window as CommitWindow).__lmCommits }))
const total = (counts: Record<string, number>) => Object.values(counts).reduce((sum, value) => sum + value, 0)

test('dragging a package commits React at the preview throttle rate, not once per pointer move', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${PLANNER_ROUTE}?debug&packages=1000&quality=low`, 'manager')
  await waitIdle(page)
  expect(total(await commits(page)), 'the injected hook sees React commits').toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click()
  await page.getByRole('combobox', { name: 'Chọn kiện', exact: true }).selectOption('BENCH-01000-01')
  await renderCameraChange(page, () => cameraPreset(page, 'Trên'))
  await renderCameraChange(page, () => page.getByRole('button', { name: 'Tập trung vào kiện', exact: true }).click())
  await waitIdle(page)

  const start = await proxyPoint(page), end = await proxyPoint(page, [-6, 4, 0])
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-editor-status]')?.dataset.dragging === 'true')
  const before = await commits(page)
  const moves = 60, startedAt = Date.now()
  for (let i = 1; i <= moves; i++) {
    const t = Math.abs(((i % 30) / 15) - 1)
    await page.mouse.move(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t)
    await page.waitForTimeout(16)
  }
  const elapsedMs = Date.now() - startedAt
  const during = await commits(page)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-editor-status]')?.dataset.dragging === 'false')

  const perRenderer = Object.fromEntries(Object.keys(during).map((name) => [name, (during[name] ?? 0) - (before[name] ?? 0)]))
  const dragCommits = total(perRenderer)
  await attachJson(testInfo, 'drag-commits', { moves, elapsedMs, perRenderer, dragCommits })
  // Mỗi pointer frame một commit sẽ ≥ số lần di chuyển. preview-store gửi snapshot tối đa ~10 lần/giây (đo: 34 commit react-dom
  // trong 3,3 s trên SwiftShader), nên số commit bám theo thời gian chứ không theo số lần di chuyển.
  const detail = `commits ${JSON.stringify(perRenderer)} over ${moves} moves in ${elapsedMs} ms`
  expect(dragCommits, detail).toBeLessThan(moves)
  expect(dragCommits, detail).toBeLessThanOrEqual(Math.ceil(elapsedMs / 100) + 6)
  expect(browserErrors).toStrictEqual([])
})
