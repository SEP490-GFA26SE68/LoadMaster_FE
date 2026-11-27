import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { R3F_DEPS, waitCameraSettled, waitDemandIdle, type R3FModule } from './viewer-helpers'

/**
 * Dáng van liền khối (đợt 5): ở form xe mới, cùng một tier, van không tốn nhiều draw call hơn xe tải — kể cả Transit hai cánh cửa — và
 * tier `low` vẫn giữ dáng van (`van-shell` còn đó). Hạng van suy từ số (`vanShapeOf`), nên chỉ cần gõ lòng thùng, cửa, tải trọng.
 */
type Dims = { l: number; w: number; h: number; kg: number }
const TRUCK: Dims = { l: 520, w: 210, h: 200, kg: 3500 }
/** HiAce LWB (cửa nâng) và Transit (hai cánh cửa) — hai kiểu cửa sau của van. */
const VANS: Record<string, Dims> = { mid: { l: 253, w: 176, h: 134, kg: 1000 }, large: { l: 308, w: 178, h: 189, kg: 1200 } }

test.use({ collectConsoleErrors: true })

async function fill(page: Page, d: Dims, van: boolean) {
  const set = (name: string, value: number) => page.getByRole('spinbutton', { name, exact: true }).fill(String(value))
  await set('Chiều dài lòng thùng', d.l)
  await set('Chiều rộng lòng thùng', d.w)
  await set('Chiều cao lòng thùng', d.h)
  await set('Chiều rộng cửa', d.w)
  await set('Chiều cao cửa', d.h)
  await set('Tải trọng tối đa', d.kg)
  // Chờ khung xem trước nhận số mới (debounce 250 ms): dáng van có `van-shell`, xe tải thì không
  await page.waitForFunction(async ({ url, van }) => {
    const { _roots } = (await import(url)) as R3FModule
    const canvas = document.querySelector('canvas:not(.maplibregl-canvas)')
    const scene = canvas ? _roots.get(canvas)?.store.getState().scene : undefined
    return Boolean(scene) && Boolean(scene!.getObjectByName('van-shell')) === van
  }, { url: R3F_DEPS, van })
  await waitCameraSettled(page)
  await waitDemandIdle(page)
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

for (const quality of ['high', 'balanced', 'low'] as const) {
  test(`${quality}: a van costs no more draw calls than a truck and keeps its shape`, async ({ page, login, browserErrors }) => {
    await login(`/doi-xe/moi?debug&quality=${quality}`)
    await expect(page.locator('canvas:not(.maplibregl-canvas)')).toBeVisible()
    await page.waitForFunction(async (url) => {
      const { _roots } = (await import(url)) as R3FModule
      const canvas = document.querySelector('canvas:not(.maplibregl-canvas)')
      return Boolean(canvas && _roots.get(canvas)?.store.getState().controls)
    }, R3F_DEPS)

    await fill(page, TRUCK, false)
    const truck = await drawCalls(page)
    expect(truck).toBeGreaterThan(0)
    for (const [name, dims] of Object.entries(VANS)) {
      await fill(page, dims, true)
      const van = await drawCalls(page)
      expect(van, name).toBeGreaterThan(0)
      expect(van, name).toBeLessThanOrEqual(truck)
    }
    expect(browserErrors).toEqual([])
  })
}
