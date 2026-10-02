import { expandPackages } from '@/domain/cargo'
import type { Package } from './package-model'
import { normalizeQrToken } from './qr-token'
import type { OrderStatus, TransportOrder, TripLabel } from './source-types'
import type { Trip } from './types'

/**
 * Hàm thuần nối kiện kho kiện ↔ kiện của chuyến (LM-104, FE-3b-07). Đơn gán vào điểm giao sinh các dòng kiện `PKG-NNN`; kiện thứ i của
 * dòng là instance thứ i (`PKG-NNN-0i`, cùng cách đặt mã của `expandPackages`). Dòng của đơn bị sửa số lượng sau khi gán thì mất liên kết
 * với đơn — kho cấp kiện kho kiện riêng cho dòng đó như kiện thêm trong chuyến. Trạng thái
 * kiện **không** còn suy ở đây: kho ghi thật qua `movePackage` (FE-3b-01); chỉ còn trạng thái `delivered` của đơn là suy lúc đọc.
 */

/** Một dòng kiện của chuyến và các kiện kho kiện của nó: kiện thứ i là instance thứ i của dòng. */
export type TripPackageLink = { lineId: string; packageIds: string[] }

/** Kiện kho kiện → mã instance của các dòng `lines` trong chuyến; dòng có số lượng khác số kiện đã nối thì bỏ qua (mất liên kết). */
export function lineInstances(lines: readonly TripPackageLink[], trip: Pick<Trip, 'packages'>): Map<string, string> {
  const instances = new Map<string, string>()
  for (const line of lines) {
    const tripLine = trip.packages.find((pkg) => pkg.id === line.lineId)
    if (tripLine?.quantity !== line.packageIds.length) continue
    const width = Math.max(2, String(tripLine.quantity).length)
    line.packageIds.forEach((packageId, index) => instances.set(packageId, `${line.lineId}-${String(index + 1).padStart(width, '0')}`))
  }
  return instances
}

/** Kiện kho kiện → mã instance trong chuyến của đơn. */
export function assignmentInstances(order: Pick<TransportOrder, 'assignment'>, trip: Pick<Trip, 'packages'> | undefined): Map<string, string> {
  return order.assignment && trip ? lineInstances(order.assignment.lines, trip) : new Map()
}

/**
 * Kiện kho kiện → mã instance của **mọi** kiện trong chuyến (FE-3b-07): kiện vào chuyến qua đơn hàng (`order.assignment`) và kiện thêm
 * ngay trong chuyến (`own`, kho ghi ở `syncTripPool`).
 */
export function tripInstances(trip: Pick<Trip, 'id' | 'packages'>, orders: Iterable<TransportOrder>, own: readonly TripPackageLink[]): Map<string, string> {
  const instances = lineInstances(own, trip)
  for (const order of orders) {
    if (order.assignment?.tripId !== trip.id) continue
    for (const [packageId, instanceId] of assignmentInstances(order, trip)) instances.set(packageId, instanceId)
  }
  return instances
}

/** Đơn đã gán mà chuyến đã hoàn thành là đã giao. */
export function effectiveOrderStatus(order: Pick<TransportOrder, 'status'>, trip: Pick<Trip, 'phase'> | undefined): OrderStatus {
  return order.status === 'assigned' && trip?.phase === 'completed' ? 'delivered' : order.status
}

/**
 * Nhãn QR của mọi instance trong chuyến (FE-3b-07): mã QR là mã của kiện kho kiện — kiện nối từ đơn hàng hoặc kiện kho tạo lúc thêm
 * kiện trong chuyến (`own`). Instance chưa có kiện kho kiện (dữ liệu hỏng) không có nhãn.
 */
export function tripLabels(
  trip: Pick<Trip, 'id' | 'packages'>,
  orders: Iterable<TransportOrder>,
  pool: ReadonlyMap<string, Pick<Package, 'qrToken'>>,
  own: readonly TripPackageLink[] = [],
): TripLabel[] {
  const poolIdOf = new Map([...tripInstances(trip, orders, own)].map(([packageId, instanceId]) => [instanceId, packageId]))
  const lineById = new Map(trip.packages.map((pkg) => [pkg.id, pkg]))
  const { instances, packageIdByInstanceId } = expandPackages(trip.packages)
  return instances.flatMap(({ packageInstanceId, deliveryStop }) => {
    const poolPackageId = poolIdOf.get(packageInstanceId)
    const qrToken = poolPackageId === undefined ? undefined : pool.get(poolPackageId)?.qrToken
    if (poolPackageId === undefined || qrToken === undefined) return []
    const packageId = packageIdByInstanceId.get(packageInstanceId) ?? ''
    return [{ packageInstanceId, packageId, name: lineById.get(packageId)?.name ?? packageId, deliveryStop, qrToken, poolPackageId }]
  })
}

/** Nhãn khớp mã quét (so sau khi chuẩn hoá). */
export function labelByToken(labels: readonly TripLabel[], token: string): TripLabel | undefined {
  const wanted = normalizeQrToken(token)
  return labels.find((label) => label.qrToken === wanted)
}
