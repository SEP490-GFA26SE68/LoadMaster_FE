import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { pinBackendPlacement, rerunBackendLoadPlan, RERUN_TIME_LIMIT_SEC, unpinBackendPlacement } from './viewer-backend-api'

/**
 * Ghim và chạy lại giữ ghim của Planner nối backend (`LoadPlanController`): ghim gửi mã số chỗ xếp của máy chủ, bỏ ghim theo đường dẫn,
 * chạy lại gửi giới hạn thời gian vừa giới hạn chờ của `api()` và mục tiêu của phương án đang xem.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('ghim gửi mã số chỗ xếp; bỏ ghim gọi DELETE theo mã chỗ xếp', async () => {
  const { calls } = stubBackend({
    'POST /api/load-plans/12/pin': { body: envelope(null) },
    'DELETE /api/load-plans/12/pin/305': { body: envelope(null) },
  })
  await pinBackendPlacement('12', '305')
  await unpinBackendPlacement('12', '305')
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(['POST /api/load-plans/12/pin', 'DELETE /api/load-plans/12/pin/305'])
  expect(calls[0]?.body).toEqual({ placementId: 305 })
})

test('chạy lại giữ ghim: gửi giới hạn thời gian và mục tiêu, trả mã phương án mới và mã job', async () => {
  const { calls } = stubBackend({ 'POST /api/load-plans/12/rerun': { body: envelope({ id: 13, jobUuid: 'job-77', version: 2, parentPlanId: 12 }) } })
  expect(await rerunBackendLoadPlan('12', 'AXLE_BALANCE')).toEqual({ planId: '13', jobId: 'job-77' })
  expect(calls[0]?.body).toEqual({ timeLimitSec: RERUN_TIME_LIMIT_SEC, objective: 'AXLE_BALANCE' })

  // Phương án không có mục tiêu (dựng tay): không gửi mục tiêu; máy chủ không trả mã job
  const second = stubBackend({ 'POST /api/load-plans/12/rerun': { body: envelope({ id: 14 }) } })
  expect(await rerunBackendLoadPlan('12', null)).toEqual({ planId: '14', jobId: null })
  expect(second.calls[0]?.body).toEqual({ timeLimitSec: RERUN_TIME_LIMIT_SEC })
})
