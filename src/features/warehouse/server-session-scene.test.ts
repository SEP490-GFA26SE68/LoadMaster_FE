import { expect, test } from 'vitest'
import { sessionOf } from './warehouse-dto'
import { serverSessionScene } from './server-session-scene'
import { PREVIEW } from './warehouse-preview-test-fixture'
test('real plan/execution identity, packed coordinates and obstacle cm survive the boundary', () => {
  const session = sessionOf(PREVIEW)
  expect(session).toMatchObject({ tripId: '7', loadPlanId: '50', executionId: null, executionStatus: 'NOT_STARTED', approved: true, stale: false })
  const scene = serverSessionScene(session)!
  expect(scene.model.revision?.id).toBe('50')
  expect(scene.model.vehicle.obstacles[0]).toMatchObject({ id: '1', xCm: 360.5, lengthCm: 100, widthCm: 35, heightCm: 45, loadBearing: false })
  expect(scene.model.placements[0]).toMatchObject({ orientation: 'WHL', position: { x: 100, y: 40, z: 0 }, lengthCm: 80, widthCm: 40, heightCm: 30 })
  expect(scene.model.placements[1]?.orientation).toBe('HLW')
})
test('missing identity/obstacles or invalid geometry is never replaced by a made-up scene', () => {
  const session = sessionOf(PREVIEW)
  expect(serverSessionScene({ ...session, loadPlanId: null })).toBeNull()
  expect(serverSessionScene({ ...session, obstacles: null })).toBeNull()
  expect(serverSessionScene({ ...session, stale: true })).toBeNull()
  expect(serverSessionScene({ ...session, placements: session.placements.map((p) => ({ ...p, x: -1 })) })).toBeNull()
  expect(serverSessionScene({ ...session, placements: session.placements.map((p) => ({ ...p, rotation: null })) })).toBeNull()
})
