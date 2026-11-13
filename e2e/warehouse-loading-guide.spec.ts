import { expect, test } from './fixtures'
import { PREVIEW } from '../src/features/warehouse/warehouse-preview-test-fixture'

for (const viewport of [{ width: 1600, height: 1000 }, { width: 820, height: 1180 }]) {
  test('3D execution CODE safety and completion ' + viewport.width, async ({ page, login, browserErrors }, testInfo) => {
    await page.setViewportSize(viewport)
    const unexpected: string[] = []
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (['localhost', '127.0.0.1'].includes(url.hostname)) return route.fallback()
      unexpected.push('external host blocked')
      return route.abort()
    })
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '/* local font fixture */' }))
    await page.route('**/src/lib/backend-config.ts*', route => route.fulfill({
      contentType: 'application/javascript',
      body: `export const BACKEND_FEATURES=['warehouse'];
        export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['warehouse']),keycloak:{url:'',realm:'',clientId:''}};
        export const usesBackend=(name)=>name==='warehouse'; export const resolveBackendConfig=()=>backendConfig;`,
    }))
    await page.route('**/src/lib/api-client.ts*', async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: (await response.text()) + "\nconnectApiAuth(()=>Promise.resolve('fixture-guide-token'));\n" })
    })
    let current = PREVIEW
    let stale = false
    let reject = true
    let posts = 0
    let reads = 0
    const staged = new Set<number>()
    await page.route('**/api/**', async route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      const key = request.method() + ' ' + path
      const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
      if (key === 'GET /api/warehouse/tasks/7/plan') return stale
        ? route.fulfill({ status: 409, json: { success: false, code: 'PLAN_STALE' } }) : ok(current)
      if (key === 'GET /api/warehouse/tasks/7') { reads++; return ok(current) }
      const stage = path.match(/^\/api\/warehouse\/tasks\/7\/staging\/packages\/(1|2)\/confirm$/)
      if (request.method() === 'POST' && stage) {
        const id = Number(stage[1])
        expect(request.postDataJSON()).toEqual({ method: 'CODE', code: 'PK-' + id })
        staged.add(id)
        current = { ...current, stagingComplete: staged.size === 2, placements: current.placements!.map(p => ({ ...p, staged: staged.has(p.packageId!) })) }
        return ok(null)
      }
      const confirm = path.match(/^\/api\/warehouse\/placements\/(71|72)\/confirm$/)
      if (request.method() === 'POST' && confirm) {
        posts++
        const id = Number(confirm[1])
        expect(request.postDataJSON()).toEqual({ tripId: '7', method: 'CODE', code: 'PK-' + (id - 70) })
        expect(current.stagingComplete).toBe(true)
        if (reject) return route.fulfill({ status: 409, json: { success: false, code: 'CONFLICT' } })
        current = { ...current, placements: current.placements!.map(p => p.placementId === id ? { ...p, status: 'CONFIRMED' } : p) }
        if (id === 71) return route.abort('failed') // Commit with lost ACK.
        return ok(null)
      }
      if (key === 'POST /api/warehouse/tasks/7/complete') {
        expect(current.placements!.every(p => p.status === 'CONFIRMED')).toBe(true)
        current = { ...current, status: 'COMPLETED' }
        return ok({ status: 'COMPLETED', tripStatus: 'LOADING' })
      }
      unexpected.push(key)
      return route.fulfill({ status: 500, json: { success: false, code: 'UNEXPECTED_REQUEST' } })
    })
    await login('/kho?chuyen=7&xem=3d', 'warehouse')
    await expect(page.locator('canvas')).toBeVisible()
    await page.getByRole('button', { name: '#2 · PK-2 Chưa xếp', exact: true }).click()
    await expect(page.getByText('320 cm', { exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Góc nhìn thùng xe', exact: true }).selectOption('tren')
    await page.locator('canvas').click({ position: { x: 200, y: 200 } })
    expect(posts).toBe(0)
    await expect(page.getByRole('button', { name: /Nhập Package Code/ })).toHaveCount(0)
    // Execution was started by the existing workflow/another device; preview itself never POSTs start.
    current = { ...PREVIEW, executionId: 60, status: 'IN_PROGRESS', stagingRequired: true, stagingComplete: false }
    await page.getByRole('button', { name: 'Làm mới phương án', exact: true }).click()
    await page.getByRole('button', { name: 'Đã xem lại phiên hiện hành', exact: true }).click()
    await expect(page.getByRole('button', { name: /Nhập Package Code/ })).toHaveCount(0)
    await page.getByRole('link', { name: 'Về phiên soạn / xếp', exact: true }).click()
    await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('tab', { name: /Gõ mã/ }).click()
    for (const code of ['PK-1', 'PK-2']) {
      await dialog.getByLabel('Mã kiện', { exact: true }).fill(code)
      await dialog.getByRole('button', { name: 'Đối chiếu mã', exact: true }).click()
      await expect.poll(() => staged.size).toBe(code === 'PK-1' ? 1 : 2)
      if (code === 'PK-1') await expect(dialog.getByRole('status')).toBeVisible()
    }
    await expect(page.getByText('Đã xếp 0 / 2 kiện', { exact: true })).toBeVisible()
    await page.goto('/kho?chuyen=7&xem=3d')
    await page.getByRole('button', { name: '#2 · PK-2 Chưa xếp', exact: true }).click()
    await page.getByRole('button', { name: 'Nhập Package Code — bước 1', exact: true }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel('Mã kiện', { exact: true }).fill('PK-2')
    await dialog.getByRole('button', { name: 'Xác nhận đã đặt kiện', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('không phải kiện')
    expect(posts).toBe(0)
    await dialog.getByLabel('Mã kiện', { exact: true }).fill('PK-1')
    await dialog.getByRole('button', { name: 'Xác nhận đã đặt kiện', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Xác nhận đã đặt kiện', exact: true })).toBeDisabled()
    expect(posts).toBe(1)
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
    reject = false
    await page.getByRole('button', { name: 'Nhập Package Code — bước 1', exact: true }).click()
    await dialog.getByLabel('Mã kiện', { exact: true }).fill('PK-1')
    await dialog.getByRole('button', { name: 'Xác nhận đã đặt kiện', exact: true }).click()
    await expect(page.getByText('Phiên xếp đã ghi kết quả 1 / 2 kiện.', { exact: true })).toBeVisible()
    expect(posts).toBe(2)
    await page.screenshot({ path: testInfo.outputPath('execution-' + viewport.width + '.png') })
    await page.reload()
    await page.getByRole('button', { name: 'Nhập Package Code — bước 2', exact: true }).click()
    await dialog.getByLabel('Mã kiện', { exact: true }).fill('PK-2')
    await dialog.getByRole('button', { name: 'Xác nhận đã đặt kiện', exact: true }).click()
    await expect(page.getByText('Phiên xếp đã ghi kết quả 2 / 2 kiện.', { exact: true })).toBeVisible()
    expect(posts).toBe(3)
    await page.getByRole('link', { name: 'Về phiên soạn / xếp', exact: true }).click()
    await page.getByRole('button', { name: 'Hoàn tất xếp hàng', exact: true }).click()
    await expect(page.getByText('Đã xếp xong chuyến TRIP-PREVIEW', { exact: true })).toBeVisible()
    await page.goto('/kho?chuyen=7&xem=3d')
    await expect(page.getByText('Đã hoàn tất xếp hàng — chờ tài xế xuất phát.', { exact: true })).toBeVisible()
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.getByRole('button', { name: /Nhập Package Code|Hoàn tất xếp hàng/ })).toHaveCount(0)
    stale = true
    await page.getByRole('button', { name: 'Làm mới phương án', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('lỗi thời')
    await expect(page.locator('canvas')).toHaveCount(0)
    expect(reads).toBeGreaterThan(5)
    expect(unexpected).toEqual([])
    expect(browserErrors).toEqual([])
  })
}
