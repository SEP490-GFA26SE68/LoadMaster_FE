import type { Page, TestInfo } from '@playwright/test'
import type { CameraControls } from '@react-three/drei'
import type { ComponentRef } from 'react'
import type { InstancedMesh, Mesh, Vector3Tuple } from 'three'

/**
 * Đọc scene R3F thật của Vite dev server; không có cầu nối test hay biến toàn cục trong code
 * sản phẩm. File deps này chỉ re-export chunk chung mà app đã nạp, nên `_roots` là cùng một
 * Map dù URL không kèm `?v=`. Hàm truyền vào `page.evaluate` chạy trong trình duyệt: không
 * tham chiếu biến bên ngoài, mọi giá trị đi qua tham số; `import type` bị xoá khi transpile.
 */
export const R3F_DEPS = '/node_modules/.vite/deps/@react-three_fiber.js'
export type R3FModule = Pick<typeof import('@react-three/fiber'), '_roots'>
export type CameraControlsImpl = ComponentRef<typeof CameraControls>

export type ScreenPoint = { x: number; y: number }
export type SceneSnapshot = {
  instances: { name: string; count: number }[]
  meshes: number
  proxy: Vector3Tuple | undefined
  target: Vector3Tuple
  direction: Vector3Tuple
  eventsEnabled: boolean
  controlsEnabled: boolean
}
/** Thuộc tính `data-*` của DebugOverlay (`?debug`), giữ nguyên chuỗi như DOM trả về. */
export type ViewerMetrics = Record<
  'fps' | 'frameTimeMs' | 'drawCalls' | 'triangles' | 'placementCount' | 'dpr' | 'qualityTier' | 'renderedFrames' | 'idle',
  string
>
export type VisibleCargo = { 'cargo-opaque': number; 'cargo-dim': number; 'cargo-hull'?: number }

export function sceneSnapshot(page: Page): Promise<SceneSnapshot> {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas')!)!.store.getState()
    const controls = s.controls as CameraControlsImpl
    const proxy = s.scene.getObjectByName('editor-proxy')
    const instances: SceneSnapshot['instances'] = []
    let meshes = 0
    s.scene.traverse((o) => {
      const instanced = o as InstancedMesh
      if (instanced.isInstancedMesh) instances.push({ name: o.name, count: instanced.count })
      if ((o as Mesh).isMesh && !instanced.isInstancedMesh) meshes++
    })
    const target = controls.getTarget(s.camera.position.clone())
    return { instances, meshes, proxy: proxy?.position.toArray(), target: target.toArray(),
      direction: s.camera.position.clone().sub(target).normalize().toArray(),
      eventsEnabled: s.events.enabled, controlsEnabled: controls.enabled }
  }, R3F_DEPS)
}

/** Toạ độ màn hình của proxy editor, dịch thêm `deltaCm` theo trục nghiệp vụ X/Y/Z (cm; scene = cm × 0,01). */
export function proxyPoint(page: Page, deltaCm: Vector3Tuple = [0, 0, 0]): Promise<ScreenPoint> {
  return page.evaluate(async ({ url, delta }) => {
    const { _roots } = (await import(url)) as R3FModule
    const canvas = document.querySelector('canvas')!
    const s = _roots.get(canvas)!.store.getState()
    const proxy = s.scene.getObjectByName('editor-proxy')!
    const position = proxy.getWorldPosition(proxy.position.clone())
    position.x += delta[0] / 100
    position.y += delta[2] / 100
    position.z += delta[1] / 100
    position.project(s.camera)
    const r = canvas.getBoundingClientRect()
    return { x: r.x + (position.x + 1) * r.width / 2, y: r.y + (1 - position.y) * r.height / 2 }
  }, { url: R3F_DEPS, delta: deltaCm })
}

const CPU_THROTTLE = Number(process.env.E2E_CPU_THROTTLE ?? 0)
const FRAME_INTERVAL_MS = Number(process.env.E2E_FRAME_INTERVAL_MS ?? 0)
/** Máy giả lập chậm bao nhiêu lần thì mọi giới hạn chờ nới bấy nhiêu lần; chạy thường là 1. */
const SLOWDOWN = Math.max(1, CPU_THROTTLE, FRAME_INTERVAL_MS / 16)
/** Giới hạn cho một lần chờ scene: 30 giây, nới theo mức giả lập máy chậm. */
export const SCENE_WAIT_MS = 30_000 * SLOWDOWN

/**
 * Dựng lại máy CI chậm tại chỗ để soát test đo theo thời gian. Mặc định tắt cả hai:
 * - `E2E_CPU_THROTTLE=20` (hoặc 40) hãm luồng chính của trang qua CDP: React và JS chậm đi;
 * - `E2E_FRAME_INTERVAL_MS=350` giãn `requestAnimationFrame` ra ít nhất chừng đó ms, như renderer phần mềm 2–4 FPS — CDP không
 *   hãm tiến trình GPU nên riêng hãm CPU không dựng lại được số frame thấp.
 * Gọi sau `login()`: riêng việc mở app bản dev dưới hãm 40× đã mất 1–8 phút mỗi test (tuỳ máy đang bận tới đâu) mà không soát
 * được gì ở màn 3D. Giờ của test và giới hạn chờ nới theo cùng hệ số: thứ được soát là thứ tự và điều kiện chờ, không phải tổng
 * thời gian.
 */
export async function emulateSlowMachine(page: Page, testInfo: TestInfo) {
  if (SLOWDOWN > 1) {
    testInfo.setTimeout(testInfo.timeout * SLOWDOWN)
    page.setDefaultTimeout(SCENE_WAIT_MS)
  }
  if (FRAME_INTERVAL_MS > 0) {
    await page.evaluate((interval) => {
      // Mỗi callback vẫn chạy trong một animation frame thật của riêng nó (giữ điểm xả microtask giữa các callback, thứ
      // react-spring dựa vào để xin frame kế); chỉ nhịp frame bị giãn ra. Mã tự cấp đủ lớn để không lẫn với mã của trình duyệt.
      type Entry = { id: number; callback: FrameRequestCallback; native?: number }
      const FIRST_ID = 2 ** 30
      const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window)
      let queue: Entry[] = [], flying: Entry[] = [], nextId = FIRST_ID, scheduled = false, lastFrameAt = -Infinity
      const flush = () => {
        scheduled = false
        lastFrameAt = performance.now()
        flying = queue
        queue = []
        for (const entry of flying) {
          entry.native = request((time) => { flying = flying.filter((other) => other !== entry); entry.callback(time) })
        }
      }
      window.requestAnimationFrame = (callback) => {
        const entry: Entry = { id: nextId++, callback }
        queue.push(entry)
        if (!scheduled) { scheduled = true; window.setTimeout(flush, Math.max(0, lastFrameAt + interval - performance.now())) }
        return entry.id
      }
      window.cancelAnimationFrame = (id) => {
        if (id < FIRST_ID) { cancel(id); return }
        const entry = flying.find((other) => other.id === id)
        if (entry?.native !== undefined) cancel(entry.native)
        queue = queue.filter((other) => other.id !== id)
        flying = flying.filter((other) => other.id !== id)
      }
    }, FRAME_INTERVAL_MS)
  }
  if (CPU_THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE })
  }
}

export async function waitIdle(page: Page) {
  await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-viewer-performance]')?.dataset.idle === 'true')
}

/**
 * Chờ demand loop dừng thật: canvas đã vẽ ít nhất một frame, R3F không còn nợ frame nào (`internal.frames === 0`) và renderer
 * không vẽ thêm frame nào suốt `quietMs`. Đọc thẳng R3F như `waitCameraSettled`: overlay lấy mẫu 500 ms một lần nên ngay sau thao
 * tác nó còn giữ mẫu "nghỉ" cũ, và một nhịp chờ cố định thì máy chậm chưa kịp vẽ xong.
 *
 * Hỏi bằng `requestIdleCallback`: lượt hỏi lúc luồng chính rảnh mới được kết luận sau `quietMs`. Khi React còn đang dựng lại
 * scene (chưa commit nên chưa xin frame nào) thì luồng chính không rảnh, quãng lặng giữa cú bấm và lần commit không bị tính là
 * nghỉ. Trình duyệt không cho lượt rảnh nào (dưới hãm CPU của CDP có lúc cả phút) thì hỏi theo hẹn giờ và đòi lặng gấp năm lần.
 * Việc đến sau một timer dài hơn thế thì hàm này không đoán trước được: khi đó chờ hiệu ứng của thao tác hiện ra trong scene
 * rồi mới gọi.
 */
export async function waitDemandIdle(page: Page, quietMs = 1_000) {
  await page.evaluate(async ({ url, quietMs, timeoutMs }) => {
    const { _roots } = (await import(url)) as R3FModule
    await new Promise<void>((resolve, reject) => {
      let since = performance.now(), quietSince = since, drawn = 0
      const ask = (deadline: IdleDeadline) => {
        const now = performance.now(), canvas = document.querySelector('canvas')
        const s = canvas ? _roots.get(canvas)?.store.getState() : undefined
        const frame = s?.gl ? s.gl.info.render.frame : 0
        // Frame đầu vừa ra: tính giờ lại, phần chờ màn dựng xong không ăn vào phần chờ loop dừng
        if (frame > 0 && drawn === 0) since = now
        if (!s || frame === 0 || s.internal.frames > 0 || frame !== drawn) quietSince = now
        drawn = frame
        if (now - quietSince >= (deadline.didTimeout ? quietMs * 5 : quietMs)) resolve()
        else if (now - since > timeoutMs) reject(new Error(`${drawn ? 'demand loop did not stop' : 'the 3D canvas drew nothing'} within ${timeoutMs / 1000} s`))
        else requestIdleCallback(ask, { timeout: 250 })
      }
      requestIdleCallback(ask, { timeout: 250 })
    })
  }, { url: R3F_DEPS, quietMs, timeoutMs: SCENE_WAIT_MS })
}

/** Số frame renderer đã vẽ, đọc thẳng từ three.js: không qua overlay nên không trễ theo nhịp lấy mẫu của nó. */
export function drawnFrames(page: Page): Promise<number> {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    return _roots.get(document.querySelector('canvas')!)!.store.getState().gl.info.render.frame
  }, R3F_DEPS)
}

/**
 * Chờ camera đứng yên thật trước khi so tư thế camera. `waitIdle` đọc DebugOverlay: overlay chỉ
 * công bố mẫu mỗi 500 ms và báo nghỉ sau 250 ms không có frame, nên ngay sau thao tác nó có thể
 * còn giữ mẫu "nghỉ" cũ (camera chưa kịp đổi), hoặc báo nghỉ giả khi một frame SwiftShader chậm
 * quá 250 ms giữa lúc camera đang chuyển. Ở đây đọc thẳng R3F: không còn frame nào được lên lịch
 * và vị trí, hướng, đích camera không đổi qua ba animation frame liên tiếp.
 */
export async function waitCameraSettled(page: Page) {
  await page.evaluate(async ({ url, timeoutMs }) => {
    const { _roots } = (await import(url)) as R3FModule
    const store = _roots.get(document.querySelector('canvas')!)!.store
    const started = performance.now()
    await new Promise<void>((resolve, reject) => {
      let previous = '', stableTicks = 0, ticks = 0
      const tick = () => {
        const s = store.getState(), controls = s.controls as CameraControlsImpl
        const pose = [...s.camera.position.toArray(), ...s.camera.quaternion.toArray(), ...controls.getTarget(s.camera.position.clone()).toArray()].join()
        stableTicks = s.internal.frames === 0 && pose === previous ? stableTicks + 1 : 0
        previous = pose
        ticks++
        if (ticks > 2 && stableTicks >= 3) resolve()
        else if (performance.now() - started > timeoutMs) reject(new Error(`camera did not settle within ${timeoutMs / 1000} s`))
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, { url: R3F_DEPS, timeoutMs: SCENE_WAIT_MS })
}

/** Tư thế đích camera-controls đang hướng tới: vị trí rồi tâm nhìn. */
function cameraGoal(page: Page): Promise<number[]> {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas')!)!.store.getState(), controls = s.controls as CameraControlsImpl
    return [...controls.getPosition(s.camera.position.clone(), true).toArray(), ...controls.getTarget(s.camera.position.clone(), true).toArray()]
  }, R3F_DEPS)
}

/**
 * Thực hiện thao tác đổi camera rồi chờ tư thế mới được vẽ. `CameraRig` đổi camera trong effect
 * chạy sau commit, nên ngay sau thao tác `waitCameraSettled` có thể thấy tư thế cũ đứng yên. Hàm
 * chờ đích camera đổi (effect đã chạy) rồi mới chờ camera đứng yên. Không tự xin frame: từ LM-056
 * `CameraRig` tự `invalidate()` sau mỗi lệnh camera, kể cả khi giảm chuyển động.
 */
export async function renderCameraChange(page: Page, action: () => Promise<unknown>) {
  const previous = await cameraGoal(page)
  await action()
  await page.evaluate(async ({ url, previous, timeoutMs }) => {
    const { _roots } = (await import(url)) as R3FModule
    const store = _roots.get(document.querySelector('canvas')!)!.store
    const started = performance.now()
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        const s = store.getState(), controls = s.controls as CameraControlsImpl
        const goal = [...controls.getPosition(s.camera.position.clone(), true).toArray(), ...controls.getTarget(s.camera.position.clone(), true).toArray()]
        if (goal.some((value, i) => value !== previous[i])) resolve()
        else if (performance.now() - started > timeoutMs) reject(new Error(`camera goal did not change within ${timeoutMs / 1000} s`))
        else requestAnimationFrame(tick)
      }
      tick()
    })
  }, { url: R3F_DEPS, previous, timeoutMs: SCENE_WAIT_MS })
  await waitCameraSettled(page)
}

/** Chờ một nhịp cố định để thao tác kịp đánh thức demand loop, rồi chờ scene nghỉ lại. */
export async function settle(page: Page, delayMs: number) {
  await page.waitForTimeout(delayMs)
  await waitIdle(page)
}

export function metrics(page: Page): Promise<ViewerMetrics> {
  return page.locator('[data-viewer-performance]').evaluate((el) => ({ ...el.dataset }) as ViewerMetrics)
}

export function visibleCargo(page: Page): Promise<VisibleCargo> {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas')!)!.store.getState()
    const result: Record<string, number> = {}
    for (const name of ['cargo-opaque', 'cargo-dim', 'cargo-hull']) {
      const mesh = s.scene.getObjectByName(name) as InstancedMesh | undefined
      if (!mesh) continue
      const matrix = s.camera.matrixWorld.clone()
      let visible = 0
      for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); if (matrix.elements[0] > 0) visible++ }
      result[name] = visible
    }
    return result as VisibleCargo
  }, R3F_DEPS)
}

/** Toạ độ màn hình của tâm một instance; `name` là tên InstancedMesh (mặc định kiện đặc, `obstacle-body` cho vật cản). */
export function instancePoint(page: Page, index: number, name = 'cargo-opaque'): Promise<ScreenPoint> {
  return page.evaluate(async ({ url, index, name }) => {
    const { _roots } = (await import(url)) as R3FModule
    const canvas = document.querySelector('canvas')!
    const s = _roots.get(canvas)!.store.getState()
    const mesh = s.scene.getObjectByName(name) as InstancedMesh, matrix = s.camera.matrixWorld.clone()
    mesh.getMatrixAt(index, matrix)
    const p = s.camera.position.clone().setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld).project(s.camera)
    const r = canvas.getBoundingClientRect()
    return { x: r.x + (p.x + 1) * r.width / 2, y: r.y + (1 - p.y) * r.height / 2 }
  }, { url: R3F_DEPS, index, name })
}

export function hasSceneObject(page: Page, name: string): Promise<boolean> {
  return page.evaluate(async ({ url, name }) => {
    const { _roots } = (await import(url)) as R3FModule
    return Boolean(_roots.get(document.querySelector('canvas')!)!.store.getState().scene.getObjectByName(name))
  }, { url: R3F_DEPS, name })
}

export type CameraPresetLabel = 'Trên' | 'Cửa sau' | 'Bên hông' | 'Trước' | 'Góc chéo' | 'Gầm xe'

/** Chọn một dòng của `Select` Radix trên thanh công cụ Planner (LM-094): bấm nút mở, bấm dòng, chờ danh sách đóng. */
async function pickOption(page: Page, combobox: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: combobox, exact: true }).click()
  const item = page.getByRole('option', { name: option, exact: typeof option === 'string' })
  await item.click()
  await item.waitFor({ state: 'detached' })
}

export async function cameraPreset(page: Page, label: CameraPresetLabel) {
  await pickOption(page, 'Góc nhìn', label)
}

/** Tập trung một điểm giao bằng ô "Tập trung điểm giao" (dòng "Điểm N · <tên>"). */
export async function focusStop(page: Page, stop: number) {
  await pickOption(page, 'Tập trung điểm giao', new RegExp(`^Điểm ${stop} · `))
}

const INSPECTOR_TABS = { package: 'Kiện', operations: 'Vận hành', display: 'Hiển thị', packages: 'Danh sách', metrics: 'Chỉ số' } as const
export type InspectorTab = keyof typeof INSPECTOR_TABS

/** Hộp thông tin mở từ thẻ kiện (tab Kiện) hoặc từ nút "Chi tiết / Hiển thị" ở góc khung 3D — lối vào duy nhất (LM-094). */
export async function openInspector(page: Page, tab: InspectorTab = 'operations') {
  if (!await page.getByRole('dialog').count()) {
    if (tab === 'package') await page.getByRole('button', { name: 'Chọn kiện', exact: true }).click()
    else await page.getByRole('button', { name: 'Chi tiết / Hiển thị', exact: true }).click()
  }
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: INSPECTOR_TABS[tab], exact: true }).click()
  return dialog
}

export async function closeInspector(page: Page) {
  const dialog = page.getByRole('dialog')
  if (await dialog.count()) await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
}

export async function selectPlacement(page: Page, id: string) {
  const select = page.getByRole('combobox', { name: 'Chọn kiện', exact: true })
  const opened = !await select.count()
  if (opened) await openInspector(page, 'package')
  await select.selectOption(id)
  if (opened) await closeInspector(page)
}

export async function selectedPlacementId(page: Page) {
  const select = page.getByRole('combobox', { name: 'Chọn kiện', exact: true })
  return await select.count()
    ? select.inputValue()
    : (await page.getByRole('button', { name: 'Chọn kiện', exact: true }).innerText()).trim()
}

export async function enterEdit(page: Page) {
  const button = page.getByRole('button', { name: 'Chỉnh sửa', exact: true })
  if (await button.count()) await button.click()
  else await page.getByRole('button', { name: 'Chỉnh sửa kiện', exact: true }).click()
}

/**
 * Nạp module nguồn qua Vite trong trình duyệt để lấy đúng dữ liệu app đang dùng (mock
 * nghiệp vụ, fixture benchmark, operations model) mà không nhân bản logic vào test.
 */
export const SOURCE_MODULES = {
  benchmark: '/src/features/viewer3d/benchmark.mock.ts',
  /** `benchmarkScene` và `seedScene`: scene cm đúng như Planner dựng. */
  scene: '/src/test/scene.ts',
  /** `unloadSequence`, `createLifoIndex`: thứ tự dỡ và kiểm LIFO đúng như mô phỏng dỡ. */
  operations: '/src/features/viewer3d/operations/unloading.ts',
} as const
