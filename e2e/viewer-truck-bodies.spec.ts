import type { Page } from '@playwright/test'
import { attachJson, expect, PLANNER_ROUTE, test } from './fixtures'
import { R3F_DEPS, waitCameraSettled, waitDemandIdle, waitIdle, type R3FModule } from './viewer-helpers'

/**
 * Bốn thân xe tải (đợt 6): ở Planner, cùng một tier, thân mui bạt, thân lửng và thân đông lạnh không tốn nhiều draw call hơn thân
 * thùng kín, và không thân nào vượt ngân sách đo trước đợt 6 (`BUDGET` — số của thân thùng kín lúc đó, fixture 132 kiện). Kiểu thân đi
 * qua `?debug&body=…` (`benchmarkBodyStyleFromSearch`), chỉ đổi hình xe minh hoạ.
 */
const BODIES = ['TRUCK_BOX', 'TRUCK_CANVAS', 'TRUCK_FLATBED', 'TRUCK_REEFER'] as const
const TIERS = ['high', 'balanced', 'low'] as const
const BUDGET: Record<(typeof TIERS)[number], number> = { high: 21, balanced: 20, low: 15 }

test.use({ collectConsoleErrors: true })

/** Đổi URL tại chỗ (không tải lại trang) rồi chờ khung 3D vẽ đúng thân xe của URL đó. */
async function openBody(page: Page, tier: string, body: string) {
  await page.evaluate((query) => {
    history.pushState({}, '', `${location.pathname}?${query}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, `debug&packages=132&quality=${tier}&body=${body}`)
  await page.waitForFunction(async ({ url, tier, body }) => {
    const el = document.querySelector('[data-viewer-performance]')
    if (el?.getAttribute('data-quality-tier') !== tier) return false
    const { _roots } = (await import(url)) as R3FModule
    const canvas = document.querySelector('canvas:not(.maplibregl-canvas)')
    const scene = canvas ? _roots.get(canvas)?.store.getState().scene : undefined
    return scene?.getObjectByName('truck-body')?.userData.body === body
  }, { url: R3F_DEPS, tier, body })
  await waitIdle(page)
  // Đổi tier có thể dựng lại canvas ngay sau lần chờ trên: thử lại trên canvas mới
  for (let attempt = 0; ; attempt++) {
    try {
      await waitCameraSettled(page)
      await waitDemandIdle(page)
      return
    } catch (error) {
      if (attempt >= 2) throw error
      await page.waitForTimeout(500)
    }
  }
}

/** Vẽ lại một khung hình và đọc số draw call của chính khung đó. */
function drawCalls(page: Page) {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas:not(.maplibregl-canvas)')!)!.store.getState()
    s.gl.render(s.scene, s.camera)
    return s.gl.info.render.calls
  }, R3F_DEPS)
}

test('every truck body costs no more draw calls than the closed box, within the pre-wave budget, in every tier', async ({ page, login, browserErrors }, testInfo) => {
  test.setTimeout(4 * 60_000)
  await login(`${PLANNER_ROUTE}?debug&packages=132&quality=high`)
  const samples: Record<string, Record<string, number>> = {}
  for (const tier of TIERS) {
    samples[tier] = {}
    for (const body of BODIES) {
      await openBody(page, tier, body)
      samples[tier][body] = await drawCalls(page)
    }
    const box = samples[tier].TRUCK_BOX!
    expect(box, tier).toBeLessThanOrEqual(BUDGET[tier])
    for (const body of BODIES) expect(samples[tier][body], `${tier} ${body}`).toBeLessThanOrEqual(box)
  }
  await attachJson(testInfo, 'truck-body-draw-calls', samples)
  expect(browserErrors).toEqual([])
})
