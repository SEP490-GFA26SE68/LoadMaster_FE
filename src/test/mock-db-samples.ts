import { SPEC_CARTON_A, SPEC_CARTON_A_PLACEMENT, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { OptimizationRequest, OptimizationResult, PackagePlacement } from '@/domain/models'
import type { MockDb, NewTrip, Revision, Trip } from '@/lib/mock-db'

/**
 * Chuyến nhỏ trên Truck 6m (`VEHICLE-001` của seed) cho test kho mock: hai thùng Carton A (120 × 60 × 45 cm, 30 kg),
 * `PKG-001` giao điểm 3, `PKG-002` giao điểm 1.
 */
export function twoCartonTrip(): NewTrip {
  return {
    name: 'Tuyến Thủ Đức – Dĩ An – Biên Hoà',
    vehicleId: 'VEHICLE-001',
    scheduledDate: '2026-09-15',
    stops: [
      { id: 'STOP-01', name: 'Cửa hàng Bách Hoá Xanh Thủ Đức', address: '96 Võ Văn Ngân, P. Bình Thọ, Thủ Đức' },
      { id: 'STOP-02', name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An' },
      { id: 'STOP-03', name: 'Siêu thị Co.opmart Biên Hoà', address: '121 Phạm Văn Thuận, P. Tân Tiến, Biên Hoà' },
    ],
    packages: [
      { ...SPEC_CARTON_A, id: 'PKG-001', quantity: 1, deliveryStop: 3 },
      { ...SPEC_CARTON_A, id: 'PKG-002', quantity: 1, deliveryStop: 1 },
    ],
  }
}

function floorCarton(packageInstanceId: string, xCm: number, loadingOrder: number, unloadingOrder: number): PackagePlacement {
  return { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId, xCm, yCm: 0, zCm: 0, loadingOrder, unloadingOrder }
}

/**
 * Kết quả dựng tay cho `twoCartonTrip`, trên sàn ngay sau hốc bánh xe (x 0–120): `PKG-001-01` (điểm 3) ở x 120 xếp trước, dỡ sau;
 * `PKG-002-01` (điểm 1) ở x 240 xếp sau, dỡ trước. Metrics tính tay: 2 × 120 × 60 × 45 = 648.000 cm³ trong
 * 600 × 240 × 250 = 36.000.000 cm³ (1,8%); 60 kg trên 5.000 kg (1,2%); trọng tâm x = (180 + 300) / 2 = 240, y = 30, z = 22,5.
 */
export function twoCartonResult(): OptimizationResult {
  return {
    jobId: 'MOCK-JOB-001',
    status: 'COMPLETED',
    method: 'MOCK',
    isMockResult: true,
    placements: [floorCarton('PKG-001-01', 120, 1, 2), floorCarton('PKG-002-01', 240, 2, 1)],
    unplacedPackages: [],
    metrics: {
      totalVehicleVolumeCm3: 36_000_000,
      usedVolumeCm3: 648_000,
      volumeUtilizationPercent: 1.8,
      maxPayloadKg: 5000,
      usedPayloadKg: 60,
      payloadUtilizationPercent: 1.2,
      placedCount: 2,
      unplacedCount: 0,
      centerOfGravityCm: { x: 240, y: 30, z: 22.5 },
      runtimeMs: 12,
    },
  }
}

/** Request gửi tối ưu cho `twoCartonTrip`: Truck 6m (bằng `VEHICLE-001` của seed) và hai dòng kiện của chuyến. */
export function twoCartonRequest(): OptimizationRequest {
  return {
    vehicle: SPEC_TRUCK_6M,
    packages: twoCartonTrip().packages,
    settings: { method: 'MOCK', timeLimitSeconds: 10, randomSeed: 42, enforceLifo: true, prioritizeLowCenterOfGravity: false },
  }
}

/** Bản ghi chuyến đủ trường cho test hàm thuần (không qua kho): pha lập kế hoạch, chưa gán tài xế. */
export function tripRecord(id: string, trip: NewTrip = twoCartonTrip(), inputVersion = 1): Trip {
  return { ...trip, id, companyId: 'LOG-001', inputVersion, driverId: trip.driverId ?? null, phase: 'planning', createdAt: '2026-09-13T08:00:00.000Z' }
}

/** Tạo `twoCartonTrip` trong `db` rồi lưu `twoCartonRequest` và `result` (mặc định `twoCartonResult`) thành revision. */
export async function optimizedTwoCartonTrip(
  db: MockDb,
  result: OptimizationResult = twoCartonResult(),
): Promise<{ trip: Trip; revision: Revision }> {
  const trip = await db.createTrip(twoCartonTrip())
  const revision = await db.addRevision({ tripId: trip.id, request: twoCartonRequest(), result })
  return { trip, revision }
}
