import { describe, expect, it } from 'vitest'
import { adaptBackendScenePlacement, mapBackendRotation } from '@/features/viewer3d/backend-scene-adapter'
import type { BackendPackagePlacement } from '@/features/optimization/optimization-api'
import type { CargoPackage } from '@/features/package-pool/packages-api'
import type { TripStopApiResponse } from '@/features/trips/trips-api'

const cargo: CargoPackage = {
  id: '1', orderId: undefined, packageTypeId: undefined, deliveryRequirementId: undefined,
  customerName: null, receivedPackageCount: null, expectedPackageCount: null,
  packageCode: 'ROT-1', trackingBarcode: null, qrToken: '', lengthCm: 40, widthCm: 30,
  heightCm: 25, weightKg: 10, handlingClass: 'STANDARD', destination: '', status: 'PLANNED',
  isPinned: false, packageName: null, note: null, orientation: null, uprightOnly: null,
  fragilityLevel: null, stackable: true, maxTopLoadKg: null, maxLayers: null,
  minSupportRatio: null, priority: null, mustLoad: null, packingGroup: null,
}

// Independent expected permutations, matching the persisted Python rotation fixture.
const cases = [
  [0, 'LWH', 40, 30, 25], [1, 'WLH', 30, 40, 25], [2, 'LHW', 40, 25, 30],
  [3, 'WHL', 30, 25, 40], [4, 'HLW', 25, 40, 30], [5, 'HWL', 25, 30, 40],
] as const

describe('persisted backend rotation contract', () => {
  it.each(cases)('keeps packed dimensions for rotation %i (%s) without rotating twice', (code, orientation, x, y, z) => {
    const row: BackendPackagePlacement = {
      id: 123, package_id: '1', step_sequence: 1, pos_x: 100, pos_y: 60, pos_z: 0,
      dim_x: x, dim_y: y, dim_z: z, rotation_type: code, stopZoneId: 10, stopZoneName: 'Test',
    }
    const stop = { id: 10, stopSequence: 1 } as TripStopApiResponse
    const scene = adaptBackendScenePlacement(row, cargo, [stop])
    expect(scene.orientation).toBe(orientation)
    expect([scene.lengthCm, scene.widthCm, scene.heightCm]).toEqual([x, y, z])
    expect(scene.position).toEqual({ x: 100, y: 60, z: 0 })
    expect(row).toEqual({
      id: 123, package_id: '1', step_sequence: 1, pos_x: 100, pos_y: 60, pos_z: 0,
      dim_x: x, dim_y: y, dim_z: z, rotation_type: code, stopZoneId: 10, stopZoneName: 'Test',
    })
  })

  it.each([-1, 6, 1.5, NaN])('rejects unsupported backend rotation %s', (code) => {
    expect(() => mapBackendRotation(code)).toThrow('Unsupported backend rotation_type')
  })
})
