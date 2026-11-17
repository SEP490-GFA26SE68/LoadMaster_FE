import { expect, test } from '@playwright/test'

// Every API request is intercepted. This suite never contacts Keycloak or a real backend/balance.
test('INITIAL retries reuse a key; acknowledgement polls; reload and a finished action keep the right boundary', async ({ page }) => {
  await page.route('**/src/features/auth/keycloak.ts', route => route.fulfill({
    contentType: 'application/javascript', body: `export const keycloak = {
      authenticated: true, token: 'OFFLINE_E2E', init: async () => true, updateToken: async () => false,
      login: async () => {}, logout: async () => {}
    }`,
  }))
  const keys: string[] = []
  let failed = false
  let terminal = false
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname
    const reply = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path === '/api/users/me') return reply({ id: 1, companyId: 10, fullName: 'Offline Dispatcher', email: 'offline@example.test', phoneNumber: null, userRoleType: 'DISPATCHER', status: 'ACTIVE' })
    if (path === '/api/trips/7/optimize-loading') {
      keys.push(request.headers()['idempotency-key'] ?? '')
      if (!failed) { failed = true; return route.abort('failed') }
      return reply({ job_id: 'offline-job', dispatch_status: 'UNKNOWN' })
    }
    if (path === '/api/trips/optimization-jobs/offline-job') return reply({ job_uuid: 'offline-job', status: terminal ? 'COMPLETED' : 'RUNNING' })
    if (path.endsWith('/plans')) return reply([])
    return route.fulfill({ status: 404, json: { success: false } })
  })
  await page.goto('/chuyen/7/toi-uu')
  const start = page.getByRole('button', { name: 'Chạy tối ưu xếp hàng mới' })
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByRole('alert')).toContainText('Chưa xác nhận được')
  await expect(start).toBeDisabled()
  await page.getByRole('button', { name: 'Thử lại yêu cầu hiện tại' }).click()
  await expect(page.getByRole('button', { name: 'Kiểm tra lại trạng thái' })).toBeVisible()
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1])
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Kiểm tra lại trạng thái' })).toBeVisible()
  expect(keys).toHaveLength(2)
  terminal = true
  await page.getByRole('button', { name: 'Kiểm tra lại trạng thái' }).click()
  await expect(start).toBeEnabled()
  await start.click()
  await expect.poll(() => keys.length).toBe(3)
  expect(keys[2]).not.toBe(keys[0])
})


for (const terminal of ['PARTIAL', 'NO_SOLUTION', 'TIMEOUT']) {
  test(`${terminal} stops polling; PARTIAL loads its persisted plan; no extra POST`, async ({ page }) => {
    await page.route('**/src/features/auth/keycloak.ts', route => route.fulfill({
      contentType: 'application/javascript', body: `export const keycloak = {
        authenticated: true, token: 'OFFLINE_E2E', init: async () => true, updateToken: async () => false,
        login: async () => {}, logout: async () => {}
      }`,
    }))
    let posts = 0; let polls = 0; let planReads = 0
    await page.route('**/api/**', async route => {
      const request = route.request(); const path = new URL(request.url()).pathname
      const reply = (data: unknown) => route.fulfill({ json: { success: true, data } })
      if (path === '/api/users/me') return reply({ id: 1, companyId: 10, fullName: 'Offline Dispatcher', email: 'offline@example.test', phoneNumber: null, userRoleType: 'DISPATCHER', status: 'ACTIVE' })
      if (path === '/api/trips/7/optimize-loading') {
        posts++; return reply({ job_id: 'offline-job', dispatch_status: 'UNKNOWN' })
      }
      if (path === '/api/trips/optimization-jobs/offline-job') {
        polls++; return reply({ job_uuid: 'offline-job', status: terminal })
      }
      if (path.endsWith('/plans')) {
        planReads++
        return reply([{ id: 47, plan_name: 'Persisted partial plan', packed_items_count: 17,
          volume_utilization: 0.5, weight_utilization: 0.4, placements: [] }])
      }
      return route.fulfill({ status: 404, json: { success: false } })
    })
    await page.goto('/chuyen/7/toi-uu')
    const start = page.getByRole('button', { name: 'Chạy tối ưu xếp hàng mới' })
    await start.click()
    await expect(start).toBeEnabled()
    if (terminal === 'PARTIAL') await expect(page.getByText('Persisted partial plan')).toBeVisible()
    // Observe more than two polling intervals after the terminal response.
    const count = polls
    await page.waitForTimeout(4500)
    expect(polls).toBe(count); expect(posts).toBe(1)
    expect(planReads).toBe(terminal === 'PARTIAL' ? 1 : 0)
  })
}
