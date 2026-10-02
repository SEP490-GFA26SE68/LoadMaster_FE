/**
 * Hàm → endpoint backend (FE-0-09, issue BE S4b-07); nối backend chỉ thay thân hàm.
 *   addTripPackages   → POST /api/trips/{id}/packages
 *   removeTripPackage → DELETE /api/trips/{id}/packages/{packageId}
 *   chưa có ở BE: fetchTripPoolPackages
 */
import { getMockDb, type Package, type Trip, type TripStopTarget } from '@/lib/mock-db'

/**
 * Kiện kho kiện đưa **thẳng** vào chuyến (FE-4b-05, D-68 đường 2): điều phối viên chọn kiện Đã nhập chưa thuộc yêu cầu giao nào, gán
 * vào một điểm giao tay — không có hạn. Tách khỏi `trips-api.ts` để file đó không quá 250 dòng (AGENTS mục 11). Backend nhận thêm
 * `override` / `overrideReason` của luật phân tách hàng ở cùng endpoint — việc của FE-4b-06.
 */

/** Một kiện kho kiện đã đưa thẳng vào chuyến, kèm dòng kiện và số điểm giao của nó. */
export type TripPoolRow = { readonly package: Package; readonly lineId: string; readonly deliveryStop: number }

/** Kiện đưa thẳng từ kho kiện đang ở trong chuyến — không gồm kiện của yêu cầu giao và kiện thêm ngay trong chuyến. */
// chưa có ở BE
export async function fetchTripPoolPackages(tripId: string): Promise<TripPoolRow[]> {
  const rows = await getMockDb().listTripPackages(tripId)
  return rows.filter((row) => row.origin === 'POOL').map((row) => ({ package: row.package, lineId: row.lineId, deliveryStop: row.deliveryStop }))
}

export type AddTripPackagesInput = { readonly packageIds: readonly string[]; readonly target: TripStopTarget }

/** Đưa kiện Đã nhập vào điểm giao `target` của chuyến: điểm đang có, hoặc điểm tay mới cuối tuyến. Kiện sang "Đã gán chuyến". */
// POST /api/trips/{id}/packages
export function addTripPackages(tripId: string, { packageIds, target }: AddTripPackagesInput): Promise<Trip> {
  return getMockDb().addTripPackages(tripId, packageIds, target)
}

/** Bỏ một kiện khỏi chuyến: kiện về "Đã nhập" ở kho kiện. */
// DELETE /api/trips/{id}/packages/{packageId}
export function removeTripPackage(tripId: string, packageId: string): Promise<Trip> {
  return getMockDb().removeTripPackage(tripId, packageId)
}
