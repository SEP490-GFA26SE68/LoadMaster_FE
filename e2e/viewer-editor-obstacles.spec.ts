import type { Page } from '@playwright/test'
import { expect, PLANNER_ROUTE, test } from './fixtures'
import { SOURCE_MODULES, waitIdle } from './viewer-helpers'

/**
 * LM-073 (Spec §15 dòng 12): trong Planner của chuyến seed (xe VEHICLE-002 có hai hốc bánh không chịu tải), dời một kiện sàn
 * sát hốc bánh vào trong hốc bị chặn: trạng thái "Không thể đặt" kèm câu `OBSTACLE_OVERLAP`, vị trí không đổi, lịch sử không có lệnh.
 */
test.use({ contextOptions: { reducedMotion: 'reduce' } })

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const status = (page: Page) => page.locator('[data-editor-status]')
const position = (page: Page) => status(page).evaluate((el) => [Number(el.dataset.x), Number(el.dataset.y), Number(el.dataset.z)])

test('nudging a floor package into a non load-bearing wheel arch is blocked and leaves no command', async ({ page, login, browserErrors }) => {
  await login(`${PLANNER_ROUTE}?debug&quality=low`)
  await page.locator('canvas').waitFor()
  await waitIdle(page)
  // Kiện sàn nằm sát mép trong của hốc bánh bên trái (hốc: x 420–530, y 0–25, z 0–32): một bước Y− là chồng vào hốc.
  const picked = await page.evaluate(async (url) => {
    const { seedScene } = (await import(url)) as typeof import('@/test/scene')
    const scene = await seedScene()
    const arch = scene.vehicle.obstacles.find((obstacle) => obstacle.yCm === 0 && obstacle.type === 'WHEEL_ARCH')!
    const touching = scene.placements.find((p) => p.position.z === 0 && p.position.y === arch.yCm + arch.widthCm
      && p.position.x < arch.xCm + arch.lengthCm && p.position.x + p.lengthCm > arch.xCm)
    if (!touching) throw new Error('seed plan has no floor package touching the left wheel arch')
    return { id: touching.id, obstacleId: arch.id }
  }, SOURCE_MODULES.scene)

  await button(page, 'Chỉnh sửa').click()
  await page.getByRole('combobox', { name: 'Chọn kiện', exact: true }).selectOption(picked.id)
  const before = await position(page)
  await expect(button(page, 'Hoàn tác')).toBeDisabled()

  await button(page, 'Giảm Y').click()
  await expect(status(page)).toContainText('Không thể đặt')
  await expect(status(page)).toContainText(`${picked.id} chồng lấn vật cản ${picked.obstacleId}.`)
  expect(await position(page), 'blocked move keeps the package where it was').toStrictEqual(before)
  await expect(button(page, 'Hoàn tác'), 'a blocked move is not a command').toBeDisabled()
  expect(browserErrors).toStrictEqual([])
})
