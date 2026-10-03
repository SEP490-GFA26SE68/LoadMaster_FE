import { expect, test } from 'vitest'
import type { CargoPackage, OptimizationRequest, OptimizationResult, PackagePlacement } from '@/domain/models'
import { planApproval } from '@/features/viewer3d/approval/plan-approval'
import { adaptResult } from '@/features/viewer3d/scene-input'
import { createViewerDraft, patchPlacement, resolveEffectiveScene } from '@/features/viewer3d/viewer-draft'
import { seedScene } from '@/test/scene'

const VEHICLE: OptimizationRequest['vehicle'] = {
  id: 'TRUCK', name: 'Thùng thử', innerLengthCm: 720, innerWidthCm: 235, innerHeightCm: 240, maxPayloadKg: 5000,
  doorWidthCm: 235, doorHeightCm: 240, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
}

function pkg(id: string, extra: Partial<CargoPackage> = {}): CargoPackage {
  return {
    id, name: id, lengthCm: 100, widthCm: 100, heightCm: 50, weightKg: 10, quantity: 1,
    allowedOrientations: ['LWH'], keepUpright: true, fragilityLevel: 'NONE', stackable: true,
    maxTopLoadKg: 100, minSupportRatio: 0.8, deliveryStop: 1, priority: 0, mustLoad: false, ...extra,
  }
}

const at = (id: string, x: number, order: number): PackagePlacement => ({
  packageInstanceId: `${id}-01`, orientation: 'LWH', xCm: x, yCm: 0, zCm: 0, placedLengthCm: 100, placedWidthCm: 100, placedHeightCm: 50,
  loadingOrder: order, unloadingOrder: 3 - order, supportRatio: 1, constraintWarnings: [],
})

/** A và B xếp cạnh nhau; C (bắt buộc hay không tuỳ test) chưa xếp. */
function model({ mustLoad = false, tripVersion = 1 } = {}) {
  const request: OptimizationRequest = {
    vehicle: VEHICLE, packages: [pkg('A'), pkg('B'), pkg('C', { mustLoad })],
    settings: { method: 'MOCK', timeLimitSeconds: 10, enforceLifo: false, prioritizeLowCenterOfGravity: false },
  }
  const result: OptimizationResult = {
    jobId: 'JOB-1', status: 'COMPLETED', method: 'MOCK', isMockResult: true,
    placements: [at('A', 0, 1), at('B', 100, 2)],
    unplacedPackages: [{ packageInstanceId: 'C-01', reasonCode: 'NO_SPACE', message: 'NO_SPACE' }],
    metrics: {
      totalVehicleVolumeCm3: 0, usedVolumeCm3: 0, volumeUtilizationPercent: 0, maxPayloadKg: 5000, usedPayloadKg: 20,
      payloadUtilizationPercent: 0, placedCount: 2, unplacedCount: 1, runtimeMs: 0,
    },
  }
  return adaptResult({
    trip: { id: 'TRIP', stops: [{ name: 'Kho' }], inputVersion: tripVersion },
    revision: { id: 'REV-001', jobId: 'JOB-1', inputVersion: 1, request, result, ordersRecomputed: false, manuallyEdited: false },
  })
}

test('the approved seed plan can be approved again with no blockers and no patches', async () => {
  const seed = await seedScene()
  const approval = planApproval(seed, seed.placements, createViewerDraft())!
  expect([approval.blockers.canApprove, approval.blockers.issues, approval.patches]).toStrictEqual([true, [], []])
})

test('a must-load package left unplaced blocks approval (D-24)', () => {
  const plan = model({ mustLoad: true })
  const approval = planApproval(plan, plan.placements, createViewerDraft())!
  expect(approval.blockers.canApprove).toBe(false)
  expect(approval.blockers.issues.map(({ code }) => code)).toStrictEqual(['MUST_LOAD_UNPLACED'])
})

test('a revision made before the trip changed is stale and cannot be approved (D-31)', () => {
  const plan = model({ tripVersion: 2 })
  expect(plan.revision?.stale).toBe(true)
  const approval = planApproval(plan, plan.placements, createViewerDraft())!
  expect([approval.blockers.canApprove, approval.blockers.stale, approval.blockers.issues]).toStrictEqual([false, true, []])
})

test('draft moves become repository patches and are checked: moving B onto A blocks approval with an overlap', () => {
  const plan = model()
  const draft = patchPlacement(plan, createViewerDraft(), 'B-01', { position: { x: 50, y: 0, z: 0 } })
  const effective = resolveEffectiveScene(plan, draft).placements
  const approval = planApproval(plan, effective, draft)!
  expect(approval.patches).toStrictEqual([{ packageInstanceId: 'B-01', xCm: 50, yCm: 0, zCm: 0, orientation: 'LWH' }])
  expect(approval.blockers.canApprove).toBe(false)
  expect(approval.blockers.issues.map(({ code }) => code)).toContain('OVERLAP')
})

test('a manual move that overloads an axle group blocks approval with AXLE_OVERLOAD (D-78)', () => {
  // Trục trước ở x −120 (rỗng 2.000 kg), trục sau ở 460 (rỗng 1.800 kg), cách nhau 580 cm; loại xe giới hạn trục sau 1.808 kg.
  // A và B (10 kg mỗi kiện) ở x 0..100 và 100..200: trọng tâm 100 → trục sau 1.800 + 20 × 220 / 580 = 1.807,59 kg, còn trong giới hạn.
  const plan = model()
  const axles = [
    { id: 'AXLE-01', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 2000, maxLoadKg: 3000 },
    { id: 'AXLE-02', name: 'Trục sau', positionXCm: 460, emptyLoadKg: 1800, maxLoadKg: 9000 },
  ]
  const limited = { ...plan, engineInput: { ...plan.engineInput!, vehicle: { ...VEHICLE, axles, rearAxleLimitKg: 1808 } } }
  expect(planApproval(limited, limited.placements, createViewerDraft())!.blockers.issues).toStrictEqual([])

  // Dời B ra x 600..700: trọng tâm (50 + 650) / 2 = 350 → trục sau 1.800 + 20 × 470 / 580 = 1.816,21 kg.
  const draft = patchPlacement(limited, createViewerDraft(), 'B-01', { position: { x: 600, y: 0, z: 0 } })
  const approval = planApproval(limited, resolveEffectiveScene(limited, draft).placements, draft)!
  expect([approval.blockers.canApprove, approval.blockers.issues]).toStrictEqual([
    false,
    [{ code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'rear', loadKg: 1816.21, limitKg: 1808, overKg: 8.21 } }],
  ])
})
