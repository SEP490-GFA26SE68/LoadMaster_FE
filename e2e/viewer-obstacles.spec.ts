import type { Page } from '@playwright/test'
import type { InstancedMesh } from 'three'
import { attachJson, expect, PLANNER_ROUTE, test } from './fixtures'
import {
  cameraPreset, closeInspector, enterEdit, hasSceneObject, instancePoint, metrics, openInspector, R3F_DEPS, renderCameraChange,
  sceneSnapshot, waitCameraSettled, waitIdle, type R3FModule,
} from './viewer-helpers'

/** Fixture benchmark 132 kiện; khoá tier để số draw call không đổi theo quality adaptation. */
const route = (obstacles?: 0 | 1 | 20) =>
  `${PLANNER_ROUTE}?debug&packages=132&quality=balanced${obstacles === undefined ? '' : `&obstacles=${obstacles}`}`

async function restingDrawCalls(page: Page) {
  await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('[data-viewer-performance]')?.dataset.drawCalls) > 0)
  await waitCameraSettled(page)
  await waitIdle(page)
  return Number((await metrics(page)).drawCalls)
}

/** Số giao cắt của tia từ camera qua tâm vật cản đầu tiên với thân vật cản. */
function obstacleHits(page: Page) {
  return page.evaluate(async (url) => {
    const { _roots } = (await import(url)) as R3FModule
    const s = _roots.get(document.querySelector('canvas')!)!.store.getState()
    const mesh = s.scene.getObjectByName('obstacle-body') as InstancedMesh
    const matrix = s.camera.matrixWorld.clone()
    mesh.getMatrixAt(0, matrix)
    const ndc = s.camera.position.clone().setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld).project(s.camera)
    s.raycaster.setFromCamera(s.pointer.clone().set(ndc.x, ndc.y), s.camera)
    return s.raycaster.intersectObject(mesh, false).length
  }, R3F_DEPS)
}

test('obstacles add a fixed two draw calls whether there are 1 or 20 of them, and none without obstacles', async ({ page, login, browserErrors }, testInfo) => {
  await login(route())
  const drawCalls: Record<string, number> = { none: await restingDrawCalls(page) }
  expect(await hasSceneObject(page, 'vehicle-obstacles')).toBe(false)
  for (const count of [0, 1, 20] as const) {
    await page.goto(route(count))
    drawCalls[count] = await restingDrawCalls(page)
    const bodies = (await sceneSnapshot(page)).instances.filter((mesh) => mesh.name === 'obstacle-body')
    expect(bodies).toStrictEqual(count === 0 ? [] : [{ name: 'obstacle-body', count }])
  }
  await attachJson(testInfo, 'obstacle-draw-calls', drawCalls)
  expect(drawCalls[0]).toBe(drawCalls.none)
  expect(drawCalls[1]! - drawCalls[0]!).toBe(2)
  expect(drawCalls[20]).toBe(drawCalls[1])
  expect(browserErrors).toStrictEqual([])
})

test('clicking the Spec wheel arch shows its type, corner, size in cm and load bearing; edit mode never raycasts it', async ({ page, login, browserErrors }) => {
  await login(route(1))
  await waitIdle(page)
  await renderCameraChange(page, () => cameraPreset(page, 'Trên'))
  const point = await instancePoint(page, 0, 'obstacle-body')
  await page.mouse.click(point.x, point.y)
  const callout = page.locator('[data-obstacle-callout="OBS-001"]')
  await expect(callout).toContainText('Hốc bánh xe · OBS-001')
  await expect(callout).toContainText('120 × 30 × 45 cm')
  await expect(callout).toContainText('Góc tại X 0 cm · Y 0 cm · Z 0 cm')
  await expect(callout).toContainText('Không chịu tải')
  await expect(page.getByRole('list', { name: 'Vật cản trong thùng', exact: true }).getByRole('listitem'))
    .toHaveText(['Hốc bánh xe OBS-001: Góc tại X 0 cm · Y 0 cm · Z 0 cm, kích thước 120 × 30 × 45 cm, Không chịu tải.'])
  expect(await obstacleHits(page)).toBeGreaterThan(0)

  const legend = (await openInspector(page, 'display')).getByRole('region', { name: 'Vật cản', exact: true })
  await expect(legend).toContainText('Vật cản không chịu tải')
  await closeInspector(page)

  await enterEdit(page)
  await expect(callout).toHaveCount(0)
  expect(await obstacleHits(page)).toBe(0)
  expect(browserErrors).toStrictEqual([])
})
