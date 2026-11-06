import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { approveBackendEdits, pinBackendPlacement, unpinBackendPlacement } from './viewer-backend-api'

/**
 * Ghim của Planner nối backend (`LoadPlanController`): ghim gửi mã số chỗ xếp của máy chủ, bỏ ghim theo đường dẫn.
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

test('duyệt bản chỉnh: gửi chỗ xếp đã dời theo mã số, ghim chỉ khi đổi; trả bản duyệt mới đánh dấu chỉnh tay', async () => {
  const { calls } = stubBackend({
    'POST /api/load-plans/12/approve-edits': {
      body: envelope({ id: 15, tripId: 42, approved: true, manuallyEdited: true, stale: false, placements: [], unplaced: [] }),
    },
  })
  const approved = await approveBackendEdits('12', [{ placementId: '305', x: 250, y: 100.5, z: 0, rotationType: 0 }])
  expect(approved).toMatchObject({ id: '15', approved: true, manuallyEdited: true, stale: false })
  expect(calls[0]?.body).toEqual({ placements: [{ placementId: 305, posX: 250, posY: 100.5, posZ: 0, rotationType: 0 }] })

  await approveBackendEdits('12', [], ['305'])
  expect(calls[1]?.body).toEqual({ placements: [], pinnedPlacementIds: [305] })
})

test('máy chủ từ chối bản chỉnh chồng lấn: lỗi mang mã của máy chủ', async () => {
  stubBackend({ 'POST /api/load-plans/12/approve-edits': { status: 422, body: { success: false, code: 'MANUAL_EDIT_OVERLAP', message: 'x' } } })
  await expect(approveBackendEdits('12', [{ placementId: '305', x: 0, y: 0, z: 0, rotationType: 0 }])).rejects.toMatchObject({ code: 'MANUAL_EDIT_OVERLAP' })
})
