import { expect, test, attachScreenshot } from './fixtures'
import { PREVIEW } from '../src/features/warehouse/warehouse-preview-test-fixture'

test('approved 3D preview is read-only: selection, cameras, measurements, refresh and stale', async ({ page, login, browserErrors }, testInfo) => {
  const unexpected: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      unexpected.push('Blocked external host: ' + url.protocol + '//' + url.hostname)
      return route.abort()
    }
    return route.fallback()
  })
  // The app imports this optional font stylesheet; serve a local fixture, never contact Google.
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '/* isolated font fixture */' }))
  await page.route('**/src/lib/backend-config.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export const BACKEND_FEATURES=['warehouse'];
      export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['warehouse']),keycloak:{url:'',realm:'',clientId:''}};
      export const usesBackend=(name)=>name==='warehouse';
      export const resolveBackendConfig=()=>backendConfig;`,
  }))
  await page.route('**/src/lib/api-client.ts*', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()) + "\nconnectApiAuth(() => Promise.resolve('fixture-preview-token'));\n" })
  })
  let current = PREVIEW
  let stale = false
  const methods: string[] = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    methods.push(request.method())
    const key = request.method() + ' ' + new URL(request.url()).pathname
    if (key === 'GET /api/warehouse/tasks') return route.fulfill({ json: { success: true, data: [{
      tripId: 7, tripCode: 'TRIP-PREVIEW', vehicleInfo: 'Fixture truck', totalPackages: 2, loadPlanId: 50,
      departureTime: null, status: 'PLANNED', executionId: null,
    }] } })
    if (key === 'GET /api/warehouse/tasks/7/plan') return route.fulfill({
      status: stale ? 409 : 200,
      json: stale ? { success: false, code: 'PLAN_STALE' } : { success: true, data: current },
    })
    unexpected.push(key)
    return route.fulfill({ status: 500, json: { success: false, code: 'UNEXPECTED_REQUEST' } })
  })
  await login('/kho', 'warehouse')
  await page.getByRole('link', { name: 'Xem phương án 3D', exact: true }).click()
  await expect(page).toHaveURL(/chuyen=7&xem=3d/)
  await expect(page.getByText('Phương án đã duyệt · Chỉ xem', { exact: true }).first()).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: '#2 · PK-2 Chưa xếp', exact: true }).click()
  const guide = page.getByRole('region', { name: 'Hướng dẫn vị trí và hướng đặt', exact: true })
  await expect(guide.getByText('320 cm', { exact: true })).toBeVisible()
  await expect(guide.getByText('H — chiều cao gốc nằm theo chiều dọc xe (+X).', { exact: true })).toBeVisible()
  await expect(page.getByText('Phiên xếp đã ghi kết quả 0 / 2 kiện.', { exact: true })).toBeVisible()
  expect(await page.getByRole('button', { name: 'Hoàn tất xếp hàng', exact: true }).count()).toBe(0)
  const camera = page.getByRole('combobox', { name: 'Góc nhìn thùng xe', exact: true })
  await camera.selectOption('tren')
  await camera.selectOption('cua-sau')
  await camera.selectOption('goc-cheo')
  await page.getByRole('button', { name: 'Chỉ kiện này', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Hiện xung quanh', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Hiện xung quanh', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('guide-desktop.png') })
  await attachScreenshot(page, testInfo, 'warehouse-position-guide-desktop')
  await page.setViewportSize({ width: 820, height: 1180 })
  await guide.scrollIntoViewIfNeeded()
  await expect(guide.getByText('320 cm', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('guide-tablet.png') })
  await attachScreenshot(page, testInfo, 'warehouse-position-guide-tablet')
  await page.setViewportSize({ width: 1600, height: 1000 })
  current = { ...PREVIEW, loadPlanId: 99, executionId: 90, status: 'IN_PROGRESS' }
  await page.getByRole('button', { name: 'Làm mới phương án', exact: true }).click()
  await expect(page.getByText(/Phương án đã thay đổi/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Hướng dẫn vị trí và hướng đặt', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-load-plan-id="99"]')).toBeVisible()
  stale = true
  await page.getByRole('button', { name: 'Làm mới phương án', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('lỗi thời')
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(methods.every((method) => method === 'GET')).toBe(true)
  expect(unexpected).toEqual([])
  expect(browserErrors).toEqual([])
})
