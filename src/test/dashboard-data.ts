import { expandPackages } from '@/domain/cargo'
import { SPEC_CARTON_A_PLACEMENT, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage, OptimizationResult } from '@/domain/models'
import type { DashboardData } from '@/features/manager/dashboard-summary'
import type { DeliveryIssue, DeliveryProgress, Revision, Trip, VehicleState } from '@/lib/mock-db'

/**
 * Kho thu nhỏ dựng tay cho bảng điều khiển (LM-090), kỳ 08/09 → 14/09/2026. Số kỳ vọng trong test cộng tay từ khối lượng và
 * số lượng kiện dưới đây, không tính lại theo cách code tính (AGENTS mục 9).
 *
 * | Chuyến   | Ngày  | Xe | Pha / trạng thái        | Kiện (kg × số, điểm)        | Lấp đầy duyệt |
 * |----------|-------|----|-------------------------|-----------------------------|---------------|
 * | TRIP-101 | 10/09 | A  | hoàn thành              | 10 × 3 đ1, 20 × 2 đ2        | 40            |
 * | TRIP-102 | 12/09 | A  | đang giao               | 5 × 4 đ1, 15 × 2 đ2         | 60            |
 * | TRIP-103 | 09/09 | B  | huỷ                     | 100 × 1                     | 90 (bỏ)       |
 * | TRIP-104 | 14/09 | B  | đã duyệt                | 25 × 2                      | 50            |
 * | TRIP-105 | 14/09 | C  | nháp                    | 12 × 1                      | —             |
 * | TRIP-106 | 01/09 | C  | hoàn thành, ngoài kỳ    | 40 × 1                      | 70 (bỏ)       |
 * | TRIP-107 | 13/09 | A  | đã tối ưu, chưa duyệt   | 30 × 1                      | 80 (bỏ)       |
 * | TRIP-108 | 11/09 | B  | hoàn thành              | 8 × 2                       | 30            |
 *
 * Giao hàng: TRIP-101 điểm 2 khách từ chối PKG-002-02; TRIP-102 kho báo thiếu PKG-001-04, điểm 1 xong, điểm 2 đang dỡ;
 * TRIP-108 có sự cố của cả điểm 1 dù đã dỡ hai kiện. Xe A đang chạy, B sẵn sàng, C bảo dưỡng.
 */
export const DASHBOARD_PERIOD = { from: '2026-09-08', to: '2026-09-14' }

const AT = '2026-09-01T01:00:00.000Z'

export function cargo(id: string, weightKg: number, quantity: number, deliveryStop = 1): CargoPackage {
  return {
    id, name: id, lengthCm: 50, widthCm: 40, heightCm: 30, weightKg, quantity, allowedOrientations: ['LWH'], keepUpright: true,
    fragilityLevel: 'NONE', stackable: true, maxTopLoadKg: 100, minSupportRatio: 0.8, deliveryStop, priority: 1, mustLoad: true,
  }
}

export function trip(id: string, scheduledDate: string, vehicleId: string, packages: CargoPackage[], extra: Partial<Trip> = {}): Trip {
  return {
    id, companyId: 'LOG-001', name: `Tuyến ${id}`, vehicleId, stops: [], packages, inputVersion: 1, scheduledDate, driverId: null, phase: 'planning',
    createdAt: AT, ...extra,
  }
}

/** Phương án xếp đủ mọi kiện của chuyến; bảng điều khiển chỉ đọc tỷ lệ lấp đầy và cờ mock. */
export function revision(id: string, of: Trip, volumeUtilizationPercent: number, { approved = true, isMockResult = true } = {}): Revision {
  const instances = expandPackages(of.packages).instances
  const result: OptimizationResult = {
    jobId: `JOB-${id}`, status: 'COMPLETED', method: isMockResult ? 'MOCK' : 'EP_DBLF', isMockResult,
    placements: instances.map((instance, index) => ({
      ...SPEC_CARTON_A_PLACEMENT, packageInstanceId: instance.packageInstanceId, xCm: index * 120,
      loadingOrder: index + 1, unloadingOrder: instances.length - index,
    })),
    unplacedPackages: [],
    metrics: {
      totalVehicleVolumeCm3: 1, usedVolumeCm3: 1, volumeUtilizationPercent, maxPayloadKg: 1, usedPayloadKg: 1,
      payloadUtilizationPercent: 1, placedCount: instances.length, unplacedCount: 0, runtimeMs: 0,
    },
  }
  return {
    id, jobId: result.jobId, tripId: of.id, result, inputVersion: of.inputVersion, createdAt: AT, manuallyEdited: false,
    ordersRecomputed: approved,
    request: {
      vehicle: SPEC_TRUCK_6M, packages: of.packages,
      settings: { method: 'MOCK', timeLimitSeconds: 10, enforceLifo: true, prioritizeLowCenterOfGravity: false },
    },
    ...(approved ? { approvedAt: AT, draftPatches: [], sourceRevisionId: id } : {}),
  }
}

/** Kho đã xếp theo `approved`: kiện trong `missing` báo thiếu, còn lại đã xếp. */
function loaded(of: Trip, approved: Revision, missing: readonly string[] = []): Trip {
  const steps = expandPackages(of.packages).instances.map(({ packageInstanceId }) => ({
    packageInstanceId, outcome: missing.includes(packageInstanceId) ? ('missing' as const) : ('loaded' as const), at: AT,
  }))
  return { ...of, phase: 'loaded', loading: { revisionId: approved.id, startedAt: AT, startedBy: null, completedAt: AT, steps } }
}

function issue(stopNumber: number, kind: DeliveryIssue['kind'], packageInstanceId?: string): DeliveryIssue {
  return { id: `ISS-${stopNumber}`, stopNumber, kind, note: 'Ghi chú', at: AT, reportedBy: null, ...(packageInstanceId ? { packageInstanceId } : {}) }
}

function delivered(of: Trip, stops: DeliveryProgress['stops'], issues: DeliveryIssue[], done: boolean): Trip {
  return {
    ...of, phase: done ? 'completed' : 'delivering',
    delivery: { startedAt: AT, startedBy: null, stops, issues, ...(done ? { completedAt: AT } : {}) },
  }
}

export function dashboardData(): DashboardData {
  const t1 = trip('TRIP-101', '2026-09-10', 'VEHICLE-A', [cargo('PKG-001', 10, 3, 1), cargo('PKG-002', 20, 2, 2)], { driverId: 'US-1' })
  const r1 = revision('REV-101', t1, 40)
  const t2 = trip('TRIP-102', '2026-09-12', 'VEHICLE-A', [cargo('PKG-001', 5, 4, 1), cargo('PKG-002', 15, 2, 2)])
  const r2 = revision('REV-102', t2, 60)
  const t3 = trip('TRIP-103', '2026-09-09', 'VEHICLE-B', [cargo('PKG-001', 100, 1)])
  const t4 = trip('TRIP-104', '2026-09-14', 'VEHICLE-B', [cargo('PKG-001', 25, 2)])
  const t5 = trip('TRIP-105', '2026-09-14', 'VEHICLE-C', [cargo('PKG-001', 12, 1)])
  const t6 = trip('TRIP-106', '2026-09-01', 'VEHICLE-C', [cargo('PKG-001', 40, 1)])
  const r6 = revision('REV-106', t6, 70)
  const t7 = trip('TRIP-107', '2026-09-13', 'VEHICLE-A', [cargo('PKG-001', 30, 1)])
  const t8 = trip('TRIP-108', '2026-09-11', 'VEHICLE-B', [cargo('PKG-001', 8, 2)])
  const r8 = revision('REV-108', t8, 30)

  const vehicleStates: VehicleState[] = [
    { vehicleId: 'VEHICLE-A', status: 'in_use', tripId: 'TRIP-102' },
    { vehicleId: 'VEHICLE-B', status: 'available' },
    { vehicleId: 'VEHICLE-C', status: 'maintenance', maintenance: { note: 'Thay dầu', since: AT } },
  ]
  return {
    today: '2026-09-14',
    vehicles: [{ id: 'VEHICLE-A', name: 'Xe A' }, { id: 'VEHICLE-B', name: 'Xe B' }, { id: 'VEHICLE-C', name: 'Xe C' }],
    vehicleStates,
    users: [{ id: 'US-1', fullName: 'Phạm Quốc Dũng' }],
    trips: [
      {
        trip: delivered(loaded(t1, r1), [
          { number: 1, unloadedIds: ['PKG-001-01', 'PKG-001-02', 'PKG-001-03'], completedAt: AT },
          { number: 2, unloadedIds: ['PKG-002-01'], completedAt: AT },
        ], [issue(2, 'refused', 'PKG-002-02')], true),
        revisions: [r1],
      },
      {
        trip: delivered(loaded(t2, r2, ['PKG-001-04']), [
          { number: 1, unloadedIds: ['PKG-001-01', 'PKG-001-02', 'PKG-001-03'], completedAt: AT },
          { number: 2, unloadedIds: ['PKG-002-01'] },
        ], [], false),
        revisions: [r2],
      },
      {
        trip: { ...t3, phase: 'cancelled', cancellation: { at: AT, by: null, reason: 'Khách hoãn', fromPhase: 'planning' } },
        revisions: [revision('REV-103', t3, 90)],
      },
      { trip: t4, revisions: [revision('REV-104', t4, 50)] },
      { trip: t5, revisions: [] },
      { trip: delivered(loaded(t6, r6), [{ number: 1, unloadedIds: ['PKG-001-01'], completedAt: AT }], [], true), revisions: [r6] },
      { trip: t7, revisions: [revision('REV-107', t7, 80, { approved: false })] },
      {
        trip: delivered(loaded(t8, r8), [{ number: 1, unloadedIds: ['PKG-001-01', 'PKG-001-02'], completedAt: AT }], [issue(1, 'other')], true),
        revisions: [r8],
      },
    ],
  }
}
