import type { StartLoadingDto } from './warehouse-dto'
export const PREVIEW: StartLoadingDto = {
  executionId: null, loadPlanId: 50, tripId: 7, tripCode: 'TRIP-PREVIEW', vehicleInfo: 'Fixture truck',
  approved: true, stale: false, status: 'NOT_STARTED', startedAt: null, totalPackages: 2,
  innerLength: 600, innerWidth: 240, innerHeight: 250, obstacles: [{
    id: 1, type: 'WHEEL_ARCH', x: '360.5', y: 0, z: 0, length: 100, width: 35, height: 45, loadBearing: false,
  }],
  placements: [1, 2].map((id) => ({
    placementId: 70 + id, packageId: id, packageName: 'Package ' + id, packageCode: 'PK-' + id,
    trackingBarcode: 'BC-' + id, qrToken: 'QR-' + id,
    posX: id * 100, posY: 40, posZ: 0, packedLength: 80, packedWidth: 40, packedHeight: 30,
    rotation: id === 1 ? 3 : 4, sequence: id, stopSequence: id, status: 'PENDING',
  })),
}
