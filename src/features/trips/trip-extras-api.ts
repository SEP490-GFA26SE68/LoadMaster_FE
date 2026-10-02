/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   fetchTripReadiness → GET /api/v1/validate/trips/{trip_id}
 *   fetchTripRequirements → GET /api/delivery-requirements (lọc theo chuyến: chưa có ở BE)
 *   chưa có ở BE: fetchTripLabels, fetchTripReport
 *   tên sẽ đổi khi nối BE: fetchTripReadiness → validateTrip
 */

import type { TripReadiness } from '@/domain/constraints'
import type { VehicleConfig } from '@/domain/models'
import { getMockDb, isMockDbError, requirementStatus, tripReport, type DeliveryRequirement, type RequirementStatus, type Trip, type TripLabel, type TripReport } from '@/lib/mock-db'
import type { User } from '@/types/user'

/**
 * Dữ liệu chuyến thêm cho 5 luồng Review 1 (LM-104), tách khỏi `trips-api.ts` để hai đợt sửa song song không đụng nhau: kiểm tra
 * "Sẵn sàng tối ưu" (luồng 2), yêu cầu giao đã vào chuyến (FE-4b-01), nhãn QR của chuyến, báo cáo chuyến (luồng 5).
 */

/** Kiểm tra "Sẵn sàng tối ưu": mã + tham số, UI dịch nhánh `readiness`. */
// GET /api/v1/validate/trips/{trip_id}
export function fetchTripReadiness(tripId: string): Promise<TripReadiness> {
  return getMockDb().getTripReadiness(tripId)
}

/**
 * Một yêu cầu giao của chuyến kèm trạng thái hiển thị (kho ghi, cộng "Đã giao" / "Giao thiếu" suy từ kiện) và số điểm giao (1-based)
 * của nó — điểm của kiện của yêu cầu; vắng khi kiện đã rời chuyến hoặc điểm không còn.
 */
export type TripRequirement = { readonly requirement: DeliveryRequirement; readonly status: RequirementStatus; readonly stopNumber: number | undefined }

/** Yêu cầu giao đã vào chuyến, theo thứ tự điểm giao rồi hạn giao (yêu cầu chưa rõ điểm đứng cuối). */
// GET /api/delivery-requirements (lọc theo chuyến: chưa có ở BE)
export async function fetchTripRequirements(tripId: string): Promise<TripRequirement[]> {
  const db = getMockDb()
  const [requirements, packages, trip] = await Promise.all([db.listDeliveryRequirements(), db.listPackages(), db.getTrip(tripId)])
  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const numberOfStop = new Map(trip.stops.map((stop, index) => [stop.id, index + 1]))
  return requirements
    .filter((requirement) => requirement.tripId === tripId)
    .map((requirement) => {
      const members = requirement.packageIds.flatMap((id) => packageById.get(id) ?? [])
      const stopId = members.find((pkg) => pkg.tripId === tripId)?.stopId
      return { requirement, status: requirementStatus(requirement, members), stopNumber: stopId === undefined ? undefined : numberOfStop.get(stopId) }
    })
    .toSorted((a, b) => (a.stopNumber ?? Infinity) - (b.stopNumber ?? Infinity) || Date.parse(a.requirement.deadline) - Date.parse(b.requirement.deadline))
}

/** Nhãn QR của mọi kiện trong chuyến — in nhãn cho kiện nhập tay. */
// chưa có ở BE
export function fetchTripLabels(tripId: string): Promise<TripLabel[]> {
  return getMockDb().listTripLabels(tripId)
}

/** Báo cáo chuyến `/chuyen/:tripId/bao-cao`: chuyến, xe, tài xế và số liệu suy từ tiến độ kho / giao (`tripReport`). */
export type TripReportData = {
  readonly trip: Trip
  readonly vehicle: VehicleConfig | undefined
  readonly driver: User | undefined
  readonly report: TripReport
}

// chưa có ở BE
export async function fetchTripReport(tripId: string): Promise<TripReportData> {
  const db = getMockDb()
  const trip = await db.getTrip(tripId)
  const [plan, vehicles, users] = await Promise.all([
    trip.loading ? db.getRevision(trip.loading.revisionId).catch(notFoundAsUndefined) : undefined,
    db.listVehicles(),
    db.listUsers(),
  ])
  return {
    trip,
    vehicle: vehicles.find((vehicle) => vehicle.id === trip.vehicleId),
    driver: trip.driverId === null ? undefined : users.find((user) => user.id === trip.driverId),
    report: tripReport(trip, plan),
  }
}

function notFoundAsUndefined(error: unknown): undefined {
  if (isMockDbError(error) && error.code === 'NOT_FOUND') return undefined
  throw error
}
