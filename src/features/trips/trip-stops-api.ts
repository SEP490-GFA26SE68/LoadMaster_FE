/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm.
 *   chưa có ở BE: updateTripStops, addTripStop, removeTripStop (issue BE S4b-01 có `DeliveryStop` nhưng chưa có endpoint cho FE)
 */
import { getMockDb, nextStopId, type DeliveryStop, type Trip } from '@/lib/mock-db'
import { renumberDeliveryStops, stopFields, stopRemoval, type StopRemoval } from './trip-packages'

/**
 * Điểm giao của chuyến đang lập kế hoạch (LM-046, FE-4b-04): đổi thứ tự, thêm điểm tay, xoá điểm trống. Điểm của yêu cầu giao tự sinh
 * ở kho khi đưa yêu cầu vào chuyến (`requirements-api.ts`), không qua các hàm này. Tách khỏi `trips-api.ts` để file đó không quá dài.
 */

/** Đổi thứ tự điểm giao: kiện được đánh số `deliveryStop` lại theo vị trí mới (LM-046). */
// chưa có ở BE
export async function updateTripStops(tripId: string, stops: readonly DeliveryStop[]): Promise<Trip> {
  const db = getMockDb()
  const current = await db.getTrip(tripId)
  const packages = renumberDeliveryStops(current.packages, current.stops, stops)
  return db.updateTrip(tripId, { stops: [...stops], packages: [...packages] })
}

export type ManualStopInput = Pick<DeliveryStop, 'name' | 'address' | 'phone' | 'contactName' | 'lat' | 'lng'>

/**
 * Thêm một **điểm giao tay** cuối tuyến (FE-4b-04, D-73) cho kiện lẻ — kiện thêm trong chuyến, kiện đưa thẳng từ kho kiện: tên, địa
 * chỉ, toạ độ (nếu có), liên hệ; không hạn. Kho cấp mã `STOP-NN` kế tiếp.
 */
// chưa có ở BE
export async function addTripStop(tripId: string, input: ManualStopInput): Promise<Trip> {
  const db = getMockDb()
  const current = await db.getTrip(tripId)
  const { lat, lng } = input
  const stop: DeliveryStop = {
    id: nextStopId(current.stops),
    ...stopFields(input),
    ...(lat === undefined || lng === undefined ? {} : { lat, lng }),
  }
  return db.updateTrip(tripId, { stops: [...current.stops, stop] })
}

/** Xoá điểm giao; còn kiện thì không ghi gì và trả về số kiện bị ảnh hưởng để UI báo. */
// chưa có ở BE
export async function removeTripStop(tripId: string, stopId: string): Promise<StopRemoval> {
  const db = getMockDb()
  const current = await db.getTrip(tripId)
  const removal = stopRemoval(current.packages, current.stops, stopId)
  if (!removal.allowed) return removal
  await db.updateTrip(tripId, { stops: [...removal.stops], packages: [...removal.packages] })
  return removal
}
