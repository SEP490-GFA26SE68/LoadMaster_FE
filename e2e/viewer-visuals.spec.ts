import type { Page } from '@playwright/test'
import type { InstancedMesh, Material, Mesh } from 'three'
import { attachJson, attachScreenshot, expect, PLANNER_ROUTE, test } from './fixtures'
import {
  cameraPreset, drawnFrames, emulateSlowMachine, metrics, R3F_DEPS, renderCameraChange, SCENE_WAIT_MS, sceneSnapshot, SOURCE_MODULES,
  visibleCargo, waitDemandIdle, waitIdle, type CameraControlsImpl, type R3FModule, type ViewerMetrics,
} from './viewer-helpers'

type AnimationSample = { y?: number; x?: number; visible: boolean; opacity?: number }

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/** Demand loop dừng thật (đọc thẳng R3F), rồi overlay cũng báo nghỉ: số đọc từ overlay sau đó là của scene đã yên. */
async function settle(page: Page) {
  await waitDemandIdle(page)
  await waitIdle(page)
}

// Máy giả lập 4 nhân / 4 GB như bản `.mjs`: tier ban đầu là balanced để thấy runtime tự hạ tier.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 })
  })
})

/**
 * Bấm "Tiến một bước" qua DOM rồi ghi transform thật ở từng animation frame, từ lúc hình động hiện ra tới lúc nó chạy xong: kiện
 * xếp rơi xong khi demand loop dừng, hình dỡ xong khi nó ẩn lại. Không đếm theo thời gian: máy chậm mất vài giây mới biến cú bấm
 * thành frame đầu, và react-spring chỉ tiến tối đa 64 ms mỗi frame — ở 2–4 FPS hình dỡ 260 ms kéo qua 5 frame (hơn một giây), ba
 * frame đầu gần như chưa đổi.
 */
function animationFrames(page: Page, kind: 'loading' | 'unloading'): Promise<AnimationSample[]> {
  return page.evaluate(async ({ url, scene, kind, timeoutMs }) => {
    const { _roots } = (await import(url)) as R3FModule
    const store = _roots.get(document.querySelector('canvas')!)!.store
    const samples: AnimationSample[] = [], matrix = store.getState().camera.matrixWorld.clone()
    let slot = -1
    if (kind === 'loading') {
      // GPU slot = vị trí mã kiện trong danh sách mã đã sắp (instance-layout); kiện vào ở bước 2 của seed.
      const { seedScene } = (await import(scene)) as typeof import('@/test/scene')
      const placements = (await seedScene()).placements
      slot = placements.map((p) => p.id).sort().indexOf(placements.find((p) => p.step === 2)!.id)
    }
    document.querySelector<HTMLButtonElement>('button[aria-label="Tiến một bước"]')!.click()
    const started = performance.now()
    let appeared = false
    await new Promise<void>((resolve) => {
      const sample = () => {
        const state = store.getState()
        let visible: boolean
        if (kind === 'loading') {
          (state.scene.getObjectByName('cargo-opaque') as InstancedMesh).getMatrixAt(slot, matrix)
          visible = matrix.elements[0] > 0
          samples.push({ y: matrix.elements[13], visible })
        } else {
          const mesh = state.scene.getObjectByName('unloading-motion') as Mesh | undefined
          visible = mesh?.visible ?? false
          samples.push({ x: mesh?.position.x, visible, opacity: (mesh?.material as Material | undefined)?.opacity })
        }
        appeared ||= visible
        const finished = appeared && (kind === 'loading' ? state.internal.frames === 0 : !visible)
        if (finished || performance.now() - started > timeoutMs) resolve(); else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    return samples
  }, { url: R3F_DEPS, scene: SOURCE_MODULES.scene, kind, timeoutMs: SCENE_WAIT_MS })
}

/** `smoothTime` của camera-controls: `CameraRig` đặt lại theo cờ giảm chuyển động, cùng lần commit với mọi thứ khác trong scene. */
function cameraSmoothTime(page: Page): Promise<number> {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    return (_roots.get(document.querySelector('canvas')!)!.store.getState().controls as CameraControlsImpl).smoothTime
  }, R3F_DEPS)
}

const range = (values: number[]) => Math.max(...values) - Math.min(...values)

test('truck details, loading spring, unloading fade and reduced motion all return to idle', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${PLANNER_ROUTE}?debug&quality=high`, 'dispatcher'); await emulateSlowMachine(page, testInfo); await settle(page)
  await renderCameraChange(page, () => cameraPreset(page, 'Trước')); await settle(page)
  const bounds = (await page.locator('canvas').boundingBox())!
  await page.mouse.move(bounds.x + 45, bounds.y + bounds.height / 2)
  await page.mouse.down(); await page.mouse.move(bounds.x + 165, bounds.y + bounds.height / 2, { steps: 15 }); await page.mouse.up()
  await settle(page)
  const truck = { metrics: await metrics(page), scene: await sceneSnapshot(page) }
  expect(Number(truck.metrics.drawCalls)).toBeLessThan(100)
  await attachScreenshot(page, testInfo, 'planner-truck')
  await renderCameraChange(page, () => cameraPreset(page, 'Góc chéo')); await settle(page)
  await attachScreenshot(page, testInfo, 'planner-overview')

  // Scene phải về bước 1 (còn đúng kiện đầu) rồi mới bấm tiến: bấm sớm thì hai lần đổi bước gộp vào một commit, không kiện nào rơi
  await button(page, 'Về đầu').click()
  await expect.poll(() => visibleCargo(page), { message: 'scene rewinds to the first step', timeout: SCENE_WAIT_MS }).toMatchObject({ 'cargo-opaque': 1 })
  await settle(page)
  const load = await animationFrames(page, 'loading'), drop = load.filter((p) => p.visible)
  expect(range(drop.map((p) => p.y!)), 'loading spring updates the active instance').toBeGreaterThan(0.15)
  await settle(page)
  // "Dỡ hàng" đưa camera về cửa sau: đích camera đổi là scene đã nhận chế độ dỡ
  await renderCameraChange(page, () => button(page, 'Dỡ hàng').click()); await settle(page)
  const exit = await animationFrames(page, 'unloading'), visible = exit.filter((p) => p.visible)
  expect(visible.length > 1 && visible.some((p) => p.opacity! < 0.8), 'unloading fade is rendered').toBeTruthy()
  expect(range(visible.map((p) => p.x!)), 'unblocked package travels toward rear door').toBeGreaterThan(0.1)
  await settle(page)
  const frameCount = await drawnFrames(page)
  await page.waitForTimeout(800)
  expect(await drawnFrames(page), 'all animation returns to idle').toBe(frameCount)

  // Cờ giảm chuyển động tới scene ở lần commit sau: bấm trước lúc đó thì bước dỡ vẫn trượt như chưa giảm chuyển động
  const smoothTime = await cameraSmoothTime(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => cameraSmoothTime(page), { message: 'scene picks up reduced motion', timeout: SCENE_WAIT_MS }).toBeLessThan(smoothTime)
  await settle(page)
  const reduced = await animationFrames(page, 'unloading'), reducedVisible = reduced.filter((p) => p.visible)
  expect(reducedVisible.length, 'reduced motion still shows the unloaded cargo').toBeGreaterThan(0)
  expect(new Set(reducedVisible.map((p) => p.x)).size, 'reduced motion never translates the cargo').toBeLessThanOrEqual(1)
  await settle(page)
  await attachJson(testInfo, 'report', { truck, animations: { loadingFrames: drop.length, unloadingFrames: visible.length, idle: true, reducedMotion: true } })
  expect(browserErrors).toStrictEqual([])
})

test('runtime quality monitor downgrades to low under sustained software-renderer load', async ({ page, login, browserErrors }, testInfo) => {
  await login(`${PLANNER_ROUTE}?debug&packages=1000`, 'dispatcher'); await emulateSlowMachine(page, testInfo); await settle(page)
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
  await login('/tai-xe/diem-giao?chuyen=TRIP-2026-0914&debug&quality=balanced', 'driver'); await emulateSlowMachine(page, testInfo)
  await button(page, 'Xem vị trí hàng').click(); await settle(page)
  await attachScreenshot(page, testInfo, 'driver-phone')
  const phone = (await page.locator('canvas').boundingBox())!
  await attachJson(testInfo, 'report', { phone })
  expect(phone.width).toBe(390)
  expect(browserErrors).toStrictEqual([])
})
