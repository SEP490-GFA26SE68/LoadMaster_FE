import { expect, test } from './fixtures'
import { navigateInApp, optimizeAndCompare, signInWith } from './spec-flow-helpers'

/**
 * Credit của lần chạy tối ưu 3D (FE-8-05, D-89): điều phối viên Phương Nam (gói Basic, còn 2 credit) chạy hai lần — mỗi lần dùng một
 * credit — rồi hết credit: màn Thiết lập tối ưu hiện nút Tối ưu mờ kèm lý do ngay trên nút, trước khi bấm.
 */
test.use({ collectConsoleErrors: true })

const SETUP = '/chuyen/TRIP-PN-001/toi-uu'

test('a Phương Nam dispatcher spends the last two credits and then sees Optimize dimmed with the reason', async ({ page, browserErrors }) => {
  await page.goto('/')
  await signInWith(page, 'dieuphoi@phuongnam.vn')
  await navigateInApp(page, SETUP)

  const credit = page.getByRole('region', { name: 'Credit', exact: true })
  const optimize = page.getByRole('button', { name: 'Tối ưu', exact: true })
  await expect(credit).toContainText('Lần chạy này dùng 1 credit · còn 2')
  await expect(credit).toContainText('Hạng thuật toán của gói Basic')
  await expect(credit.locator('[data-algorithm-tier]')).toHaveText('EP + DBLF')
  await expect(optimize).toBeEnabled()

  await optimizeAndCompare(page)
  await navigateInApp(page, SETUP)
  await expect(credit).toContainText('Lần chạy này dùng 1 credit · còn 1')
  await optimizeAndCompare(page)
  await navigateInApp(page, SETUP)

  // Hết credit: mờ trước khi bấm, lý do nằm trên nút và ở thẻ credit
  await expect(credit).toContainText('Lần chạy này dùng 1 credit · còn 0')
  await expect(credit.getByRole('alert')).toHaveText('Hết credit — liên hệ quản trị công ty')
  await expect(optimize).toBeDisabled()
  await expect(optimize).toHaveAccessibleDescription('Hết credit — liên hệ quản trị công ty')
  expect(browserErrors).toStrictEqual([])
})
