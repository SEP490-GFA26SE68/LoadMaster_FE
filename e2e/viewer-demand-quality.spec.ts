import { attachJson, expect, PLANNER_ROUTE, test } from './fixtures'
import { metrics, waitIdle, type ViewerMetrics } from './viewer-helpers'

type QualityTier = 'low' | 'balanced' | 'high'
const EXPECTED_DPR: Record<QualityTier, string> = { low: '0.5', balanced: '1.5', high: '2' }
/** Tuỳ chọn khi đo tay (`VIEWER_INITIAL_QUALITY=low`), mặc định balanced như bản `.mjs`. */
const INITIAL_TIER = (process.env.VIEWER_INITIAL_QUALITY ?? 'balanced') as QualityTier

// Renderer mặc định: không ép SwiftShader, quan sát đúng thứ Chromium cung cấp; DPR thiết bị 2.
test.use({ deviceScaleFactor: 2, launchOptions: { args: [] } })

test('demand rendering publishes FPS while moving, idles afterwards and switches DPR per tier', async ({ page, login, browserErrors }, testInfo) => {
  const report: { initialTier: QualityTier; samples: ViewerMetrics[]; tiers: ViewerMetrics[]; environment?: unknown } = {
    initialTier: INITIAL_TIER, samples: [], tiers: [],
  }
  await login(`${PLANNER_ROUTE}?debug&packages=1000&quality=${INITIAL_TIER}`, 'manager')
  await waitIdle(page)
  expect((await metrics(page)).dpr).toBe(EXPECTED_DPR[INITIAL_TIER])
  report.environment = await page.locator('canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')
    const extension = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      renderer: gl && extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : 'unavailable',
    }
  })
  const bounds = await page.locator('canvas').boundingBox()
  expect(bounds).toBeTruthy()
  const cx = bounds!.x + bounds!.width / 2
  const cy = bounds!.y + bounds!.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let index = 0; index < 24; index++) {
    await page.mouse.move(cx + Math.sin(index / 5) * 120, cy + Math.cos(index / 5) * 60, { steps: 2 })
    await page.waitForTimeout(90)
    report.samples.push(await metrics(page))
  }
  await page.mouse.up()
  expect(report.samples.some((sample) => Number(sample.fps) > 0 && Number(sample.frameTimeMs) > 0), 'active camera must publish FPS and frame time').toBeTruthy()
  await waitIdle(page)
  const settledFrames = (await metrics(page)).renderedFrames
  await page.waitForTimeout(1200)
  expect((await metrics(page)).renderedFrames, 'camera must settle back to demand idle').toBe(settledFrames)

  for (const [tier, expectedDpr] of [['low', '0.5'], ['high', '2'], ['balanced', '1.5']] as const) {
    await page.evaluate((quality) => {
      const url = new URL(location.href)
      url.searchParams.set('quality', quality)
      history.pushState({}, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, tier)
    await page.waitForFunction((quality) => document.querySelector('[data-viewer-performance]')?.getAttribute('data-quality-tier') === quality, tier)
    await waitIdle(page)
    const sample = await metrics(page)
    expect(sample.dpr).toBe(expectedDpr)
    expect(sample.placementCount).toBe('1000')
    expect(Number(sample.drawCalls)).toBeLessThan(100)
    report.tiers.push(sample)
  }
  await attachJson(testInfo, `demand-quality-${INITIAL_TIER}`, { ...report, idleExtraFrames: 0 })
  expect(browserErrors).toStrictEqual([])
})
