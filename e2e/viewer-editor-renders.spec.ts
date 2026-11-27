import type { Page } from '@playwright/test'
import { attachJson, expect, PLANNER_ROUTE, test } from './fixtures'
import { cameraPreset, proxyPoint, R3F_DEPS, renderCameraChange, waitIdle, type R3FModule } from './viewer-helpers'

type CommitWindow = Window & {
  __lmCommits?: Record<string, number>
  /** Có giá trị thì mỗi commit của react-dom cộng tên các component vừa vẽ lại (`PerformedWork`) vào đây. */
  __lmRendered?: Record<string, number>
  __lmSizeChanges?: number
}
type FiberNode = { tag: number; type: unknown; flags: number; alternate: FiberNode | null; child: FiberNode | null; sibling: FiberNode | null }

/**
 * Thay React Profiler (LM-035): hook DevTools giả đặt trước khi React nạp, đếm commit của từng renderer (react-dom và R3F).
 * Kéo không được đưa pointer frame qua React: preview cập nhật imperative, panel chỉ nhận snapshot đã giới hạn tần suất.
 * Hook còn đi cây fiber của react-dom như DevTools: chỉ xuống nhánh có con mới (`child` khác bản cũ), một component đã vẽ lại khi
 * mới gắn hoặc mang cờ `PerformedWork` (bit 1) — nhánh bị bỏ qua nhờ `memo` không có cờ đó.
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
        onCommitFiberRoot(id: number, root: { current: FiberNode }) {
          const name = names.get(id) ?? `renderer-${id}`
          counts[name] = (counts[name] ?? 0) + 1
          const rendered = target.__lmRendered
          if (!rendered || name !== 'react-dom') return
          const nameOf = (type: unknown): string | undefined => {
            if (typeof type === 'function') return (type as { displayName?: string }).displayName ?? type.name
            if (!type || typeof type !== 'object') return undefined
            const wrapper = type as { displayName?: string; render?: unknown; type?: unknown }
            return wrapper.displayName ?? nameOf(wrapper.render ?? wrapper.type)
          }
          // FunctionComponent, ClassComponent, ForwardRef, MemoComponent, SimpleMemoComponent
          const componentTags = [0, 1, 11, 14, 15]
          const stack = [root.current]
          while (stack.length) {
            const fiber = stack.pop()!
            const fresh = fiber.alternate === null
            const component = componentTags.includes(fiber.tag) ? nameOf(fiber.type) : undefined
            if (component && (fresh || (fiber.flags & 1) === 1)) rendered[component] = (rendered[component] ?? 0) + 1
            if (fiber.sibling) stack.push(fiber.sibling)
            if (fiber.child && (fresh || fiber.child !== fiber.alternate!.child)) stack.push(fiber.child)
          }
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
  await login(`${PLANNER_ROUTE}?debug&packages=1000&quality=low`)
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
  // Nhịp commit ~10 lần/giây là thứ cần giữ. "Ít commit hơn số lần di" chỉ chứng minh được khi các lần di dày hơn nhịp đó: máy CI
  // (SwiftShader, 2 nhân) mất ~120 ms mỗi lần di với 1.000 kiện, nên 60 lần di kéo dài hơn 6 s và số commit theo thời gian vượt 60
  // dù vẫn đúng nhịp (LM-108: 66 commit trong 7,7 s)
  if (elapsedMs / moves < 90) expect(dragCommits, detail).toBeLessThan(moves)
  expect(dragCommits, detail).toBeLessThanOrEqual(Math.ceil(elapsedMs / 100) + 6)
  expect(browserErrors).toStrictEqual([])
})

// Bước phát lại chỉ đổi bước hiện tại: thanh tiến trình và cảnh vẽ lại, phần còn lại của Planner giữ nguyên nhờ `memo` và props hẹp.
// `<Canvas>` không vẽ lại (cảnh đi qua `SceneChannel`), nên R3F không `setSize` — cỡ khung trong store giữ đúng đối tượng cũ.
test('a playback step re-renders the timeline and scene, not the Planner chrome or the Canvas root', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${PLANNER_ROUTE}?debug&packages=1000&quality=low`)
  await waitIdle(page)
  const slider = page.getByRole('slider', { name: 'Bước xếp', exact: true })
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  // Phím tắt vẽ trong một transition: chờ thanh trượt về bước đầu rồi mới đếm
  await page.keyboard.press('Home')
  await expect(slider).toHaveValue(await slider.getAttribute('min') ?? '1')
  await waitIdle(page)
  const start = Number(await slider.inputValue())
  await page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const store = _roots.get(document.querySelector('canvas:not(.maplibregl-canvas)')!)!.store
    const target = window as CommitWindow
    target.__lmSizeChanges = 0
    store.subscribe((state, previous) => { if (state.size !== previous.size) target.__lmSizeChanges = (target.__lmSizeChanges ?? 0) + 1 })
    target.__lmRendered = {}
  }, R3F_DEPS)

  const steps = 5
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('ArrowRight')
    await expect(slider).toHaveValue(String(start + i + 1))
  }
  await waitIdle(page)
  const { rendered, sizeChanges } = await page.evaluate(() => {
    const target = window as CommitWindow
    const result = { rendered: { ...target.__lmRendered }, sizeChanges: target.__lmSizeChanges }
    target.__lmRendered = undefined
    return result
  })
  await attachJson(testInfo, 'step-renders', { steps, sizeChanges, rendered })
  expect(rendered.TimelineBar, 'the hook sees the timeline follow each step').toBeGreaterThanOrEqual(steps)
  for (const name of ['ViewerHeader', 'PlannerNotices', 'WorkspaceToolbar', 'PlannerActions', 'VehicleCard', 'CanvasImpl']) {
    expect(rendered[name], `${name} re-rendered on a playback step: ${JSON.stringify(rendered)}`).toBeUndefined()
  }
  expect(sizeChanges, 'R3F keeps the measured canvas size object across steps').toBe(0)
  expect(browserErrors).toStrictEqual([])
})
