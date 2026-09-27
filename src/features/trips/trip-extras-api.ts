import type { TripReadiness } from '@/domain/constraints'
import type { VehicleConfig } from '@/domain/models'
import { getMockDb, isMockDbError, tripReport, type TransportOrder, type Trip, type TripLabel, type TripReport } from '@/lib/mock-db'
import type { User } from '@/types/user'

/**
 * Dữ liệu chuyến thêm cho 5 luồng Review 1 (LM-104), tách khỏi `trips-api.ts` để hai đợt sửa song song không đụng nhau: kiểm tra
 * "Sẵn sàng tối ưu" (luồng 2), đơn đã gán vào chuyến, nhãn QR của chuyến, báo cáo chuyến (luồng 5).
 */

/** Kiểm tra "Sẵn sàng tối ưu": mã + tham số, UI dịch nhánh `readiness`. */
export function fetchTripReadiness(tripId: string): Promise<TripReadiness> {
  return getMockDb().getTripReadiness(tripId)
}

/** Đơn hàng đã gán vào chuyến (dòng kiện có `groupId` = mã đơn). */
export async function fetchTripOrders(tripId: string): Promise<TransportOrder[]> {
  const orders = await getMockDb().listOrders()
  return orders.filter((order) => order.assignment?.tripId === tripId)
}

/** Nhãn QR của mọi kiện trong chuyến — in nhãn cho kiện nhập tay. */
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
