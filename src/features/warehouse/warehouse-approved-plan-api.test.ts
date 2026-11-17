import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { createWarehouseBackend } from './warehouse-backend-api'
import { PREVIEW } from './warehouse-preview-test-fixture'
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['warehouse']) },
  usesBackend: (feature: string) => feature === 'warehouse',
}))
beforeEach(() => connectApiAuth(() => Promise.resolve('fixture-token')))
afterEach(() => vi.unstubAllGlobals())
test('preview before start reads /plan only, preserves null execution and actual plan ID', async () => {
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope(PREVIEW) } })
  expect(await createWarehouseBackend().fetchApprovedPlan('7')).toMatchObject({ loadPlanId: '50', executionId: null, executionStatus: 'NOT_STARTED', outcomes: {} })
  expect(calls.map((c) => c.method + ' ' + c.path)).toEqual(['GET /api/warehouse/tasks/7/plan'])
})
test.each([
  { ...PREVIEW, stale: true }, { ...PREVIEW, approved: false },
])('stale/unapproved response is rejected', async (dto) => {
  stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope(dto) } })
  await expect(createWarehouseBackend().fetchApprovedPlan('7')).rejects.toMatchObject({ code: 'PLAN_STALE' })
})
test.each([
  { ...PREVIEW, loadPlanId: null }, { ...PREVIEW, tripId: 8 },
  { ...PREVIEW, status: 'ABORTED' }, { ...PREVIEW, status: 'IN_PROGRESS', executionId: null },
])('invalid identity or execution state is rejected', async (dto) => {
  stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope(dto) } })
  await expect(createWarehouseBackend().fetchApprovedPlan('7')).rejects.toMatchObject({ code: 'SERVER_ERROR' })
})
test('missing coordinates yield a specific warning, not zero', async () => {
  stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope({ ...PREVIEW, placements: PREVIEW.placements!.map((p) => ({ ...p, posX: null })) }) } })
  await expect(createWarehouseBackend().fetchApprovedPlan('7')).rejects.toMatchObject({ code: 'WAREHOUSE_GEOMETRY_INVALID' })
})
