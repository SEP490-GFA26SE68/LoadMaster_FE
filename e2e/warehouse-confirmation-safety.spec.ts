import { expect, test } from './fixtures'

// Real browser and fetch, all business HTTP is intercepted. No Keycloak/Supabase service is contacted.
test('warehouse submits Package Code, reconciles a lost ACK, reloads and completes from server state', async ({ page, login, browserErrors }) => {
  await page.route('**/src/lib/backend-config.ts*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `export const BACKEND_FEATURES=['warehouse'];
      export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['warehouse']),keycloak:{url:'',realm:'',clientId:''}};
      export const usesBackend=(name)=>name==='warehouse';
      export const resolveBackendConfig=()=>backendConfig;`,
  }))
  await page.route('**/src/lib/api-client.ts*', async (route) => {
    const original = await route.fetch()
    await route.fulfill({ response: original, body: (await original.text()) + "\nconnectApiAuth(() => Promise.resolve('browser-fixture-token'));\n" })
  })
  let confirmed = false
  let completed = false
  let confirmPosts = 0
  let reads = 0
  const unexpected: string[] = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const key = request.method() + ' ' + path
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (key === 'GET /api/warehouse/tasks/10') {
      reads++
      return ok({
        executionId: 60, loadPlanId: 50, tripId: 10, tripCode: 'TRIP-FIXTURE',
        vehicleInfo: 'Fixture truck', status: completed ? 'COMPLETED' : 'IN_PROGRESS',
        stagingRequired: true, stagingComplete: true, pendingManualCount: 0,
        placements: [{
          placementId: 71, packageId: 1, packageName: 'Fixture package', packageCode: 'PK-1',
          qrToken: 'qr-fixture', trackingBarcode: 'barcode-fixture', sequence: 1,
          posX: 0, posY: 0, posZ: 0, packedLength: 20, packedWidth: 20, packedHeight: 20,
          rotation: 0, staged: true, status: confirmed ? 'CONFIRMED' : 'PENDING',
          stopSequence: 1, stopName: 'Fixture destination',
        }],
      })
    }
    if (key === 'POST /api/warehouse/placements/71/confirm') {
      confirmPosts++
      expect(request.postDataJSON()).toEqual({ tripId: '10', method: 'CODE', code: 'pk-1' })
      confirmed = true
      return route.abort('failed') // Committed fixture result; response deliberately lost.
    }
    if (key === 'POST /api/warehouse/tasks/10/complete') {
      expect(confirmed).toBe(true)
      completed = true
      return ok({ status: 'COMPLETED', tripStatus: 'LOADING' })
    }
    unexpected.push(key)
    return route.fulfill({ status: 500, json: { success: false, code: 'UNEXPECTED_FIXTURE_REQUEST' } })
  })
  await login('/kho?chuyen=10', 'warehouse')
  await page.getByRole('button', { name: 'Đối chiếu kiện', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('tab', { name: /Gõ mã/ }).click()
  await dialog.getByLabel('Mã kiện', { exact: true }).fill('WRONG')
  await dialog.getByRole('button', { name: 'Đối chiếu mã', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(confirmPosts).toBe(0)
  await dialog.getByLabel('Mã kiện', { exact: true }).fill('pk-1')
  await dialog.getByRole('button', { name: 'Đối chiếu mã', exact: true }).click()
  await expect(page.getByText(/Đã xếp mọi kiện/)).toBeVisible()
  expect(reads).toBeGreaterThanOrEqual(2)
  expect(confirmPosts).toBe(1)
  await page.reload()
  await expect(page.getByText(/Đã xếp mọi kiện/)).toBeVisible()
  expect(confirmPosts).toBe(1)
  await page.getByRole('button', { name: 'Hoàn tất xếp hàng', exact: true }).click()
  await expect(page.getByText('Đã xếp xong chuyến TRIP-FIXTURE', { exact: true })).toBeVisible()
  expect(unexpected).toEqual([])
  expect(browserErrors).toEqual([])
})
