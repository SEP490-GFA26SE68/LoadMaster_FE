import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Page } from '@playwright/test'
import { attachJson, expect, PLANNER_ROUTE, test } from './fixtures'
import { metrics, SOURCE_MODULES, waitCameraSettled, waitIdle, type ViewerMetrics } from './viewer-helpers'

/**
 * Hồi quy hiệu năng sau khi engine sang cm (LM-038). Số đo SwiftShader chỉ để so trước/sau, không phải cam kết FPS.
 * Ghi file: `VIEWER_BENCH_RECORD=docs/benchmarks/viewer-cm-<ngày>.json pnpm test:e2e e2e/viewer-benchmark-cm.spec.ts`.
 */
const COUNTS = [132, 300, 500, 1000] as const
const TIERS = ['low', 'balanced', 'high'] as const
const EDITOR_BUDGET_MS = process.env.CI ? 12 : 8

async function openRoute(page: Page, search: string) {
  await page.evaluate((query) => {
    history.pushState({}, '', `${location.pathname}?${query}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, search)
  await page.waitForFunction((query) => {
    const params = new URLSearchParams(query)
    const el = document.querySelector('[data-viewer-performance]')
    return el?.getAttribute('data-placement-count') === params.get('packages') && el?.getAttribute('data-quality-tier') === params.get('quality')
  }, search)
  await waitIdle(page)
}

test('draw calls stay flat from 132 to 1,000 cm packages in every tier, idle renders no extra frame, editor check fits the drop budget', async ({ page, login, browserErrors }, testInfo) => {
  test.setTimeout(8 * 60_000)
  const samples: { count: number; tier: string; rest: ViewerMetrics }[] = []
  await login(`${PLANNER_ROUTE}?debug&packages=132&quality=low`)
  await waitIdle(page)
  for (const tier of TIERS) {
    for (const count of COUNTS) {
      await openRoute(page, `debug&packages=${count}&quality=${tier}`)
      const rest = await metrics(page)
      expect(Number(rest.drawCalls), `${tier} ${count}`).toBeLessThan(100)
      samples.push({ count, tier, rest })
    }
    const perTier = samples.filter((sample) => sample.tier === tier).map((sample) => sample.rest.drawCalls)
    expect(new Set(perTier).size, `${tier}: draw calls must not grow with package count (${perTier.join(', ')})`).toBe(1)
  }
  // Đổi tier (DPR, bóng) vẫn có thể vẽ vài frame sau khi overlay báo nghỉ: chờ camera đứng yên thật rồi mới đo nghỉ.
  await waitCameraSettled(page)
  await waitIdle(page)
  await page.waitForTimeout(600)
  const settled = (await metrics(page)).renderedFrames
  await page.waitForTimeout(1200)
  expect((await metrics(page)).renderedFrames, 'idle adds no frame').toBe(settled)

  // Xử lý một lần thả trong trình duyệt: snap đã rẻ, phần đắt là đồng bộ + kiểm constraint engine ở 1.000 kiện (D-29).
  const editor = await page.evaluate(async ({ scene, engine }) => {
    const { benchmarkScene } = (await import(scene)) as typeof import('@/test/scene')
    const { createEditorEngine } = (await import(engine)) as typeof import('@/features/viewer3d/editor/editor-engine')
    const model = benchmarkScene(1000), checker = createEditorEngine(model)!
    const times: number[] = []
    for (let i = 0; i < 400; i++) {
      const p = model.placements[(i * 37) % 1000]!
      const start = performance.now()
      checker.sync(model.placements)
      checker.check({ ...p, position: { ...p.position, x: p.position.x + (i % 10) / 10 } })
      if (i >= 50) times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    return { samples: times.length, medianMs: times[Math.floor(times.length / 2)]!, p95Ms: times[Math.floor(times.length * 0.95)]!, maxMs: times.at(-1)! }
  }, { scene: SOURCE_MODULES.scene, engine: '/src/features/viewer3d/editor/editor-engine.ts' })
  expect(editor.p95Ms, `editor drop check p95 ${editor.p95Ms} ms`).toBeLessThanOrEqual(EDITOR_BUDGET_MS)

  const report = {
    renderer: 'Chromium SwiftShader; emulated desktop 1600×1000; not a physical-device benchmark',
    units: 'cm (SCENE_SCALE = 0.01)',
    drawCalls: Object.fromEntries(TIERS.map((tier) => [tier, samples.filter((s) => s.tier === tier).map((s) => ({ count: s.count, drawCalls: Number(s.rest.drawCalls), triangles: Number(s.rest.triangles) }))])),
    samples,
    editorDropCheck1000: editor,
  }
  await attachJson(testInfo, 'viewer-cm-benchmark', report)
  const target = process.env.VIEWER_BENCH_RECORD
  if (target) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`)
  }
  expect(browserErrors).toStrictEqual([])
})
