import { nextPackageId } from '@/domain/cargo'
import type { CargoPackage } from '@/domain/models'
import type { DeliveryStop } from '@/lib/mock-db'

export type { CargoPackage, DeliveryStop }

/**
 * Điểm giao của chuyến và `deliveryStop` của kiện (LM-046). Contract Spec chỉ có `deliveryStop` là **số thứ tự**, nên thứ tự
 * điểm giao là nguồn chuẩn: đổi thứ tự thì đánh số lại kiện ngay trong kho, kiện không giữ ID điểm giao riêng.
 * Lệch có chủ ý so với issue (kiện tham chiếu ID điểm giao): thêm trường ngoài contract vào `Trip.packages` sẽ lệch `CargoPackage`
 * của Spec; đánh số lại là một thao tác của lớp API, người dùng thấy kết quả giống nhau.
 */

const numberByStopId = (stops: readonly DeliveryStop[]) => new Map(stops.map((stop, index) => [stop.id, index + 1]))

/** Kiện giữ đúng điểm giao cũ của nó sau khi danh sách điểm giao đổi thứ tự. Thứ tự không đổi thì trả lại chính mảng cũ. */
export function renumberDeliveryStops(
  packages: readonly CargoPackage[],
  before: readonly DeliveryStop[],
  after: readonly DeliveryStop[],
): readonly CargoPackage[] {
  const next = numberByStopId(after)
  const moved = new Map(before.map((stop, index) => [index + 1, next.get(stop.id) ?? index + 1]))
  if ([...moved].every(([from, to]) => from === to)) return packages
  return packages.map((pkg) => {
    const deliveryStop = moved.get(pkg.deliveryStop) ?? pkg.deliveryStop
    return deliveryStop === pkg.deliveryStop ? pkg : { ...pkg, deliveryStop }
  })
}

/** Số kiện (đã nhân `quantity`) theo số thứ tự điểm giao; điểm không có kiện không xuất hiện. */
export function packageCountByStop(packages: readonly CargoPackage[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const { deliveryStop, quantity } of packages) {
    counts.set(deliveryStop, (counts.get(deliveryStop) ?? 0) + quantity)
  }
  return new Map([...counts].sort(([a], [b]) => a - b))
}

/** Chữ của một điểm giao nhập ở form: tên, địa chỉ, liên hệ. */
export type TripStopInput = Pick<DeliveryStop, 'name' | 'address' | 'phone' | 'contactName'>

/** Điểm giao ghi vào kho: số điện thoại và người liên hệ để trống thì bỏ hẳn trường, không lưu chuỗi rỗng. */
export function stopFields({ name, address, phone, contactName }: TripStopInput) {
  return { name, address, ...(phone ? { phone } : {}), ...(contactName ? { contactName } : {}) }
}

export type StopRemoval = {
  /** Chỉ xoá được điểm giao không còn kiện nào. */
  readonly allowed: boolean
  /** Số dòng kiện đang giao tại điểm đó. */
  readonly affectedPackages: number
  /** Số kiện thật (đã nhân `quantity`). */
  readonly affectedInstances: number
  readonly stops: readonly DeliveryStop[]
  readonly packages: readonly CargoPackage[]
}

/** Xoá một điểm giao: chặn khi còn kiện, cho phép thì đánh số lại các kiện còn lại theo danh sách mới. */
export function stopRemoval(packages: readonly CargoPackage[], stops: readonly DeliveryStop[], stopId: string): StopRemoval {
  const number = numberByStopId(stops).get(stopId)
  const affected = packages.filter((pkg) => pkg.deliveryStop === number)
  const remaining = stops.filter((stop) => stop.id !== stopId)
  return {
    allowed: affected.length === 0,
    affectedPackages: affected.length,
    affectedInstances: affected.reduce((sum, pkg) => sum + pkg.quantity, 0),
    stops: remaining,
    packages: affected.length === 0 ? renumberDeliveryStops(packages, stops, remaining) : packages,
  }
}

/** Bản sao của kiện với mã mới (D-33): mọi trường khác giữ nguyên, kể cả số lượng và ghi chú. */
export function duplicatePackage(source: CargoPackage, existingIds: readonly string[]): CargoPackage {
  return { ...source, id: nextPackageId(existingIds) }
}
