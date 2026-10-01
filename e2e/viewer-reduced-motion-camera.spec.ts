import { expect, PLANNER_ROUTE, test } from './fixtures'
import { cameraPreset, R3F_DEPS, waitCameraSettled, waitIdle, type R3FModule } from './viewer-helpers'

// Giảm chuyển động: CameraRig đổi camera không transition, camera-controls không phát sự kiện (LM-056).
test.use({ contextOptions: { reducedMotion: 'reduce' } })

/** Thời hạn để góc mới xuất hiện trên canvas; một frame SwiftShader của scene mẫu chỉ mất vài chục ms. */
const DRAW_DEADLINE_MS = 2_000

test('reduced motion draws a camera preset change without a manual frame request', async ({ page, login, browserErrors }) => {
  await login(`${PLANNER_ROUTE}?debug`)
  await waitIdle(page)
  await waitCameraSettled(page)

  // Ghi hướng nhìn của camera tại đúng lúc renderer vẽ; chỉ quan sát, không xin frame.
  const drawnBefore = await page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas')!)!.store.getState()
    const gl = s.gl, render = gl.render.bind(gl)
    const record = (camera: typeof s.camera) => {
      // Hướng từ quaternion: matrixWorld của camera chỉ được cập nhật bên trong render.
      const direction = camera.position.clone().set(0, 0, -1).applyQuaternion(camera.quaternion)
      document.documentElement.dataset.drawnCameraY = String(direction.y)
    }
    gl.render = (scene, camera) => { record(camera as typeof s.camera); render(scene, camera) }
    record(s.camera)
    return Number(document.documentElement.dataset.drawnCameraY)
  }, R3F_DEPS)
  expect(drawnBefore, 'default view is not already looking straight down').toBeGreaterThan(-0.99)

  await cameraPreset(page, 'Trên')
  await page.waitForFunction(
    () => Number(document.documentElement.dataset.drawnCameraY) < -0.99,
    undefined,
    { timeout: DRAW_DEADLINE_MS },
  )
  expect(browserErrors).toStrictEqual([])
})
