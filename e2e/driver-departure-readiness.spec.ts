import { expect, test } from './fixtures'

for (const width of [1600, 820]) {
  test('driver server readiness refresh, blocked start and preserved groups ' + width, async ({ page, login, browserErrors }, info) => {
    await page.setViewportSize({ width, height: width === 820 ? 1180 : 1000 })
    const unexpected: string[] = []
    await page.route('**/*', route => {
      if (['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)) return route.fallback()
      unexpected.push('external request blocked')
      return route.abort()
    })
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '/* isolated fixture */' }))
    await page.route('**/src/lib/backend-config.ts*', route => route.fulfill({
      contentType: 'application/javascript',
      body: `export const BACKEND_FEATURES=['driver'];
        export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['driver']),keycloak:{url:'',realm:'',clientId:''}};
        export const usesBackend=(name)=>name==='driver'; export const resolveBackendConfig=()=>backendConfig;`,
    }))
    await page.route('**/src/lib/api-client.ts*', async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: (await response.text()) + "\nconnectApiAuth(()=>Promise.resolve('fixture-driver-token'));\n" })
    })
    let ready = false
    let posts = 0
    let reads = 0
    await page.route('**/api/**', async route => {
      const request = route.request()
      const key = request.method() + ' ' + new URL(request.url()).pathname
      const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
      if (key === 'GET /api/users/me') return ok({ id: 8 })
      if (key === 'GET /api/driver/trips') {
        reads++
        return ok([
          { tripId: 10, tripCode: 'DRIVER-LOADING', status: 'LOADING', loadingCompleted: ready },
          { tripId: 11, tripCode: 'DRIVER-IN-TRANSIT', status: 'IN_TRANSIT' },
          { tripId: 12, tripCode: 'DRIVER-DELIVERED', status: 'DELIVERED' },
        ])
      }
      if (/^GET \/api\/driver\/trips\/(10|11)\/stops$/.test(key)) return ok({ stops: [] })
      if (key === 'POST /api/driver/trips/10/start') {
        posts++; ready = false
        return route.fulfill({ status: 409, json: { success: false, code: 'LOADING_NOT_COMPLETED' } })
      }
      unexpected.push(key)
      return route.fulfill({ status: 500, json: { success: false, code: 'UNEXPECTED_REQUEST' } })
    })
    await login('/tai-xe', 'driver')
    await expect(page.getByRole('button', { name: 'Xuất phát', exact: true })).toBeDisabled()
    ready = true // Warehouse completed in the shared server fixture; driver does not set readiness locally.
    await expect(page.getByRole('button', { name: 'Xuất phát', exact: true })).toBeEnabled({ timeout: 15000 })
    expect(reads).toBeGreaterThan(1)
    await expect(page.getByRole('heading', { name: 'Xếp xong — chờ xuất phát', exact: true })).toBeVisible()
    for (const code of ['DRIVER-IN-TRANSIT','DRIVER-DELIVERED']) await expect(page.getByRole('heading', { name: code, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Xuất phát', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Xuất phát', exact: true })).toBeDisabled()
    await expect(page).toHaveURL(/\/tai-xe$/)
    expect(posts).toBe(1)
    ready = true
    await page.getByRole('button', { name: 'Làm mới danh sách', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Xuất phát', exact: true })).toBeEnabled()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Xuất phát', exact: true })).toBeEnabled()
    expect(posts).toBe(1)
    await page.screenshot({ path: info.outputPath('driver-readiness-' + width + '.png') })
    expect(unexpected).toEqual([])
    expect(browserErrors).toEqual([])
  })
}
