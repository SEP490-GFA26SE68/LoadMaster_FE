import type { Page } from '@playwright/test'
import type { InstancedMesh, Material, Mesh } from 'three'
import { attachJson, attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import { cameraPreset, metrics, R3F_DEPS, sceneSnapshot, settle as settleFor, SOURCE_MODULES, type R3FModule, type ViewerMetrics } from './viewer-helpers'

type AnimationSample = { y?: number; x?: number; visible?: boolean; opacity?: number }

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const settle = (page: Page) => settleFor(page, 800)

// Máy giả lập 4 nhân / 4 GB như bản `.mjs`: tier ban đầu là balanced để thấy runtime tự hạ tier.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 })
  })
})

/** Bấm "Tiến một bước" qua DOM rồi ghi transform thật đã vẽ ở từng animation frame trong 850 ms. */
function animationFrames(page: Page, kind: 'loading' | 'unloading'): Promise<AnimationSample[]> {
  return page.evaluate(async ({ url, scene, kind }) => {
    const { _roots } = (await import(url)) as R3FModule
    // GPU slot = vị trí mã kiện trong danh sách mã đã sắp (instance-layout); kiện vào ở bước 2 của seed.
    const { seedScene } = (await import(scene)) as typeof import('@/test/scene')
    const placements = (await seedScene()).placements
    const slot = placements.map((p) => p.id).sort().indexOf(placements.find((p) => p.step === 2)!.id)
    const state = _roots.get(document.querySelector('canvas')!)!.store.getState()
    const samples: AnimationSample[] = [], matrix = state.camera.matrixWorld.clone()
    document.querySelector<HTMLButtonElement>('button[aria-label="Tiến một bước"]')!.click()
    const started = performance.now()
    // Máy chậm cần lâu hơn để React xử lý cú bấm rồi mới chạy animation: đếm 850 ms từ lúc hình dỡ hiện ra, chờ tối đa 6 giây
    let appearedAt: number | null = null
    await new Promise<void>((resolve) => {
      const sample = () => {
        if (kind === 'loading') {
          (state.scene.getObjectByName('cargo-opaque') as InstancedMesh).getMatrixAt(slot, matrix)
          samples.push({ y: matrix.elements[13] })
        } else {
          const mesh = state.scene.getObjectByName('unloading-motion') as Mesh
          samples.push({ x: mesh.position.x, visible: mesh.visible, opacity: (mesh.material as Material).opacity })
          if (mesh.visible && appearedAt === null) appearedAt = performance.now()
        }
        const now = performance.now()
        const done = kind === 'loading' || appearedAt !== null ? now - (appearedAt ?? started) > 850 : now - started > 6_000
        if (done) resolve(); else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    return samples
  }, { url: R3F_DEPS, scene: SOURCE_MODULES.scene, kind })
}

const range = (values: number[]) => Math.max(...values) - Math.min(...values)

test('truck details, loading spring, unloading fade and reduced motion all return to idle', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${PLANNER_ROUTE}?debug&quality=high`, 'manager'); await settle(page)
  await cameraPreset(page, 'Trước'); await settle(page)
  const bounds = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(bounds.x + 45, bounds.y + bounds.height / 2)
  await page.mouse.down(); await page.mouse.move(bounds.x + 165, bounds.y + bounds.height / 2, { steps: 15 }); await page.mouse.up()
  await settle(page)
  const truck = { metrics: await metrics(page), scene: await sceneSnapshot(page) }
  expect(Number(truck.metrics.drawCalls)).toBeLessThan(100)
  await attachScreenshot(page, testInfo, 'planner-truck')
  await cameraPreset(page, 'Góc chéo'); await settle(page)
  await attachScreenshot(page, testInfo, 'planner-overview')

  await button(page, 'Về đầu').click(); await settle(page)
  const load = await animationFrames(page, 'loading')
  expect(range(load.map((p) => p.y!)), 'loading spring updates the active instance').toBeGreaterThan(0.15)
  await settle(page); await button(page, 'Dỡ hàng').click(); await settle(page)
  const exit = await animationFrames(page, 'unloading'), visible = exit.filter((p) => p.visible)
  expect(visible.length > 1 && visible.some((p) => p.opacity! < 0.8), 'unloading fade is rendered').toBeTruthy()
  expect(range(visible.map((p) => p.x!)), 'unblocked package travels toward rear door').toBeGreaterThan(0.1)
  await settle(page)
  const frameCount = (await metrics(page)).renderedFrames
  await page.waitForTimeout(800)
  expect((await metrics(page)).renderedFrames, 'all animation returns to idle').toBe(frameCount)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await animationFrames(page, 'unloading'), reducedVisible = reduced.filter((p) => p.visible)
  expect(new Set(reducedVisible.map((p) => p.x)).size, 'reduced motion never translates the cargo').toBeLessThanOrEqual(1)
  await settle(page)
  await attachJson(testInfo, 'report', { truck, animations: { loadingFrames: load.length, unloadingFrames: visible.length, idle: true, reducedMotion: true } })
  expect(browserErrors).toStrictEqual([])
})

test('runtime quality monitor downgrades to low under sustained software-renderer load', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${PLANNER_ROUTE}?debug&packages=1000`, 'manager'); await settle(page)
  const adaptation: { initial: string; samples: ViewerMetrics[]; final?: string } = { initial: (await metrics(page)).qualityTier, samples: [] }
  const r = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(r.x + 40, r.y + r.height * 0.5); await page.mouse.down()
  for (let i = 0; i < 85; i++) {
    await page.mouse.move(r.x + 40 + i * 2, r.y + r.height * 0.5 + Math.sin(i / 4) * 20)
    await page.waitForTimeout(40)
    if (i % 10 === 9) {
      const sample = await metrics(page)
      adaptation.samples.push(sample)
      if (sample.qualityTier === 'low') break
    }
  }
  await page.mouse.up(); await settle(page)
  adaptation.final = (await metrics(page)).qualityTier
  await attachJson(testInfo, 'report', { adaptation })
  expect(adaptation.final, 'runtime monitor downgrades under sustained software-renderer load').toBe('low')
  expect(browserErrors).toStrictEqual([])
})

test('driver cargo view fills the phone width', { tag: '@phone' }, async ({ page, login, browserErrors }, testInfo) => {
  await login('/tai-xe/diem-giao?chuyen=TRIP-2026-0914&debug&quality=balanced', 'driver')
  await button(page, 'Xem vị trí hàng').click(); await settle(page)
  await attachScreenshot(page, testInfo, 'driver-phone')
  const phone = (await page.locator('canvas').boundingBox())!
  await attachJson(testInfo, 'report', { phone })
  expect(phone.width).toBe(390)
  expect(browserErrors).toStrictEqual([])
})
