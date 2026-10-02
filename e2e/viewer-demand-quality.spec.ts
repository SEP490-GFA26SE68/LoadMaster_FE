import type { Page } from '@playwright/test'
import { attachJson, expect, PLANNER_ROUTE, test } from './fixtures'
import { drawnFrames, emulateSlowMachine, metrics, waitDemandIdle, waitIdle, type ViewerMetrics } from './viewer-helpers'

type QualityTier = 'low' | 'balanced' | 'high'
type SampleRecorder = { __viewerSamples?: ViewerMetrics[] }
const EXPECTED_DPR: Record<QualityTier, string> = { low: '0.5', balanced: '1.5', high: '2' }
/** Tuỳ chọn khi đo tay (`VIEWER_INITIAL_QUALITY=low`), mặc định balanced như bản `.mjs`. */
const INITIAL_TIER = (process.env.VIEWER_INITIAL_QUALITY ?? 'balanced') as QualityTier

// Renderer mặc định: không ép SwiftShader, quan sát đúng thứ Chromium cung cấp; DPR thiết bị 2.
test.use({ deviceScaleFactor: 2, launchOptions: { args: [] } })

/**
 * Ghi lại mọi mẫu overlay công bố kể từ lúc gọi. Đọc overlay từng lúc từ Node thì hụt mẫu: trên máy chậm lệnh đọc chỉ chen vào
 * được khi scene đã đứng yên, đúng lúc overlay đã báo nghỉ và bỏ trống FPS.
 */
async function recordPublishedSamples(page: Page) {
  await page.locator('[data-viewer-performance]').evaluate((overlay) => {
    const samples: ViewerMetrics[] = []
    Object.assign(window, { __viewerSamples: samples } satisfies SampleRecorder)
    new MutationObserver(() => samples.push({ ...(overlay as HTMLElement).dataset } as ViewerMetrics)).observe(overlay, { attributes: true })
  })
}

const publishedSamples = (page: Page) => page.evaluate(() => (window as SampleRecorder).__viewerSamples ?? [])

test('demand rendering publishes FPS while moving, idles afterwards and switches DPR per tier', async ({ page, login, browserErrors }, testInfo) => {
  const report: { initialTier: QualityTier; samples: ViewerMetrics[]; tiers: ViewerMetrics[]; environment?: unknown } = {
    initialTier: INITIAL_TIER, samples: [], tiers: [],
  }
  await login(`${PLANNER_ROUTE}?debug&packages=1000&quality=${INITIAL_TIER}`, 'dispatcher')
  await emulateSlowMachine(page, testInfo)
  // Scene phải yên hẳn trước khi ghi mẫu: FPS ghi được sau đây chỉ có thể đến từ lần kéo camera, không phải từ animation lúc mở màn
  await waitDemandIdle(page)
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
  await recordPublishedSamples(page)
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let index = 0; index < 24; index++) {
    await page.mouse.move(cx + Math.sin(index / 5) * 120, cy + Math.cos(index / 5) * 60, { steps: 2 })
    await page.waitForTimeout(90)
  }
  await page.mouse.up()
  // Nhả chuột rồi camera còn trượt thêm: chờ demand loop dừng thật (đọc thẳng R3F) rồi mới đọc mẫu và kiểm nghỉ
  await waitDemandIdle(page)
  report.samples = await publishedSamples(page)
  expect(report.samples.some((sample) => Number(sample.fps) > 0 && Number(sample.frameTimeMs) > 0), 'active camera must publish FPS and frame time').toBeTruthy()
  await waitIdle(page)
  const settledFrames = await drawnFrames(page)
  await page.waitForTimeout(1200)
  expect(await drawnFrames(page), 'camera must settle back to demand idle').toBe(settledFrames)

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
