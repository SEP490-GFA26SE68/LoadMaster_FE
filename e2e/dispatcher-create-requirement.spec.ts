import { expect, test } from './fixtures'

test('Dispatcher creates requirement through server adapter', async ({ page, login, browserErrors }, info) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const unexpected: string[] = []
  await page.route('**/*', route => {
    if (['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)) return route.fallback()
    unexpected.push('external request blocked')
    return route.abort()
  })
  await page.route('https://tiles.goong.io/**', route => route.fulfill({ json: { version: 8, sources: {}, layers: [] } }))
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '/* fixture */' }))
  await page.route('**/src/lib/backend-config.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: "export const BACKEND_FEATURES=['trips']; export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['trips']),keycloak:{url:'',realm:'',clientId:''}}; export const usesBackend=(name)=>name==='trips'; export const resolveBackendConfig=()=>backendConfig;",
  }))
  await page.route('**/src/lib/api-client.ts*', async route => {
    const response = await route.fetch()
    await route.fulfill({ response, body: (await response.text()) + "\nconnectApiAuth(()=>Promise.resolve('fixture-token'));\n" })
  })
  const saved = { id: 741, companyId: 1, customerId: 12, customerName: 'Khách fixture', destination: 'Địa chỉ máy chủ', destinationLat: null, destinationLng: null, deadline: '2099-12-31T17:00:00', priority: 'NORMAL', status: 'PENDING', expectedPackageCount: 3, receivedPackageCount: 0, packageIds: [], tripId: null, tripCode: null, createdBy: 8, createdAt: '2026-11-11T08:00:00', note: null }
  let created = false
  const posts: unknown[] = []
  await page.route('**/api/**', route => {
    const request = route.request()
    const key = request.method() + ' ' + new URL(request.url()).pathname
    const pageReply = (data: unknown[]) => route.fulfill({ json: { success: true, data, page: 0, size: 100, totalPages: 1, totalElements: data.length, last: true } })
    if (key === 'GET /api/delivery-requirements') return pageReply(created ? [saved] : [])
    if (key === 'GET /api/customers') return pageReply([{ id: 12, companyId: 1, name: 'Khách fixture', contactPhone: '', address: '' }])
    if (key === 'POST /api/delivery-requirements') {
      posts.push(request.postDataJSON())
      created = true
      return route.fulfill({ status: 201, json: { success: true, data: saved } })
    }
    unexpected.push(key)
    return route.fulfill({ status: 500, json: { success: false, code: 'UNEXPECTED_REQUEST' } })
  })
  await login('/yeu-cau-giao', 'dispatcher')
  await page.getByRole('button', { name: 'Tạo yêu cầu giao', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tạo yêu cầu giao', exact: true })
  await dialog.getByRole('combobox', { name: 'Khách hàng / Chủ hàng' }).click()
  await page.getByRole('option', { name: 'Khách fixture' }).click()
  await dialog.getByLabel('Số kiện dự kiến').fill('3')
  await dialog.getByLabel('Tên điểm đến').fill('Kho demo')
  await dialog.getByLabel('Địa chỉ', { exact: false }).fill('Địa chỉ máy chủ')
  await dialog.getByLabel('Hạn giao').fill('2099-12-31')
  await page.screenshot({ path: info.outputPath('dispatcher-create-form.png') })
  await dialog.getByRole('button', { name: 'Tạo yêu cầu', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Xem chi tiết yêu cầu 741', exact: true })).toBeVisible()
  expect(posts).toHaveLength(1)
  expect(posts[0]).toMatchObject({ customerId: 12, expectedPackageCount: 3, destination: 'Địa chỉ máy chủ', packageIds: [] })
  await page.screenshot({ path: info.outputPath('dispatcher-created-list.png') })
  expect(unexpected).toEqual([])
  expect(browserErrors).toEqual([])
})
