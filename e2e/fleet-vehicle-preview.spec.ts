import type { Page } from '@playwright/test'
import type { CameraControls } from '@react-three/drei'
import type { ComponentRef } from 'react'
import type { BufferGeometry, InstancedMesh, MeshStandardMaterial } from 'three'
import { expect, test } from './fixtures'
import { instancePoint, R3F_DEPS, waitCameraSettled, type R3FModule } from './viewer-helpers'

/**
 * Xem trước 3D ở form xe (LM-042). Hyundai HD210 (VEHICLE-002): thùng 720 × 235 × 240 cm, hai hốc bánh ở x = 420 cm
 * dài 110 cm — nên khi gõ "600" vào chiều dài, "6" và "60" là giá trị trung gian không hợp lệ.
 */
const ROUTE = '/doi-xe/VEHICLE-002'
/** Tên chunk Three.js/R3F mà Vite dev server phục vụ (`.vite/deps/three.js`, `@react-three_fiber.js`) và chunk xem trước. */
const THREE_REQUEST = /\/\.vite\/deps\/(three|@react-three_)|VehiclePreviewViewer/

test.use({ collectConsoleErrors: true })

type CameraControlsImpl = ComponentRef<typeof CameraControls>
type FitCounter = { __previewFits?: number }

/** Đếm số lần đích camera-controls đổi, đọc mỗi animation frame từ store R3F. */
async function startFitCounter(page: Page) {
  await page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    // Canvas có thể vừa được dựng lại: chờ đúng root của canvas đang có mặt, đừng tin cái đã đọc trước đó
    const store = await new Promise<NonNullable<ReturnType<R3FModule['_roots']['get']>>['store']>((resolve) => {
      const wait = () => {
        const canvas = document.querySelector('canvas')
        const root = canvas ? _roots.get(canvas) : undefined
        if (root) resolve(root.store); else requestAnimationFrame(wait)
      }
      wait()
    })
    const counter = window as unknown as FitCounter
    counter.__previewFits = 0
    let previous = ''
    const tick = () => {
      const s = store.getState(), controls = s.controls as CameraControlsImpl
      const goal = [...controls.getPosition(s.camera.position.clone(), true).toArray(), ...controls.getTarget(s.camera.position.clone(), true).toArray()]
        .map((value) => value.toFixed(4)).join()
      if (previous !== '' && goal !== previous) counter.__previewFits! += 1
      previous = goal
      requestAnimationFrame(tick)
    }
    tick()
  }, R3F_DEPS)
}

const fitCount = (page: Page) => page.evaluate(() => (window as unknown as FitCounter).__previewFits ?? 0)

function obstacleColor(page: Page, index: number) {
  return page.evaluate(async ({ url, index }) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas')!)!.store.getState()
    const mesh = s.scene.getObjectByName('obstacle-body') as InstancedMesh<BufferGeometry, MeshStandardMaterial>
    // Mượn một `Color` từ vật liệu để không phải nạp riêng module three
    const color = mesh.material.color.clone()
    mesh.getColorAt(index, color)
    return color.getHexString()
  }, { url: R3F_DEPS, index })
}

async function openPreview(page: Page, login: (route: string) => Promise<void>, route = ROUTE) {
  await login(route)
  await expect(page.locator('canvas')).toBeVisible()
  await page.waitForFunction(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const canvas = document.querySelector('canvas')
    return Boolean(canvas && _roots.get(canvas)?.store.getState().controls)
  }, R3F_DEPS)
  await waitCameraSettled(page)
}

test('the fleet list does not request the Three.js chunk; opening a vehicle does', async ({ page, login, browserErrors }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await login('/doi-xe')
  await expect(page.getByRole('heading', { name: 'Đội xe', exact: true })).toBeVisible()
  await expect(page.getByText('Hyundai HD210 · 60C-446.32')).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(requests.filter((url) => THREE_REQUEST.test(url))).toEqual([])

  // Đối chứng: cùng bộ lọc bắt được chunk khi mở form xe, nên kết quả rỗng ở trên không phải do lọc sai
  await page.getByText('Hyundai HD210 · 60C-446.32').click()
  await expect(page.locator('canvas')).toBeVisible()
  expect(requests.some((url) => THREE_REQUEST.test(url))).toBe(true)
  expect(browserErrors).toEqual([])
})

test('typing 600 into the length re-fits the camera once; editing an obstacle does not move it', async ({ page, login, browserErrors }) => {
  await openPreview(page, login)
  await startFitCounter(page)
  const length = page.getByRole('spinbutton', { name: 'Chiều dài lòng thùng', exact: true })

  await length.clear()
  await expect(page.getByText('Đang chờ giá trị hợp lệ', { exact: true })).toBeVisible()
  await length.pressSequentially('600', { delay: 80 })
  await expect(page.getByText('Đang chờ giá trị hợp lệ', { exact: true })).toBeHidden()
  await waitCameraSettled(page)
  expect(await fitCount(page)).toBe(1)

  // Dời hốc bánh OBS-001: hình đổi, góc nhìn giữ nguyên
  await page.getByLabel('X OBS-001', { exact: true }).fill('300')
  await page.waitForTimeout(600)
  await waitCameraSettled(page)
  expect(await fitCount(page)).toBe(1)
  expect(browserErrors).toEqual([])
})

test('a new vehicle without obstacles: every intermediate length is valid, the debounce still pushes only the last', async ({ page, login, browserErrors }) => {
  // Xe mới bắt đầu từ thùng 600 cm, chưa có vật cản: "6", "60", "600" đều hợp lệ, không debounce thì camera nhảy 3 lần
  await openPreview(page, login, '/doi-xe/moi')
  await startFitCounter(page)
  const length = page.getByRole('spinbutton', { name: 'Chiều dài lòng thùng', exact: true })
  await length.clear()
  await length.pressSequentially('600', { delay: 80 })
  await page.waitForTimeout(600)
  await waitCameraSettled(page)
  // Giá trị cuối trùng kích thước đang canh khung nên không canh lại lần nào
  expect(await fitCount(page)).toBe(0)
  expect(browserErrors).toEqual([])
})

test('clicking an obstacle in 3D highlights its row, and clicking a row highlights the obstacle', async ({ page, login, browserErrors }) => {
  await openPreview(page, login)
  const normal = await obstacleColor(page, 1)
  // Màu làm nổi là token --highlight, đọc từ trang để đổi bảng màu không phải sửa test (V2.3 đổi #FACC15 → #F7CF40)
  const highlight = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--highlight').trim().slice(1).toLowerCase())

  // OBS-002 sát vách phải, phía gần camera ở góc chéo
  const point = await instancePoint(page, 1, 'obstacle-body')
  await page.mouse.click(point.x, point.y)
  await expect(page.locator('tbody[aria-current="true"]')).toContainText('OBS-002')
  await expect.poll(() => obstacleColor(page, 1)).toBe(highlight)

  await page.getByRole('cell', { name: 'OBS-001', exact: true }).click()
  await expect(page.locator('tbody[aria-current="true"]')).toContainText('OBS-001')
  await expect.poll(() => obstacleColor(page, 0)).toBe(highlight)
  expect(await obstacleColor(page, 1)).toBe(normal)
  expect(browserErrors).toEqual([])
})
