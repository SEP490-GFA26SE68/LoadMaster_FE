import { expandPackages } from '@/domain/cargo'
import { hashedQrToken, LABEL_SALT, normalizeQrToken } from './qr-token'
import type { OrderStatus, RegisteredPackage, RegisteredPackageStatus, TransportOrder, TripLabel } from './source-types'
import type { Trip } from './types'

/**
 * Hàm thuần nối kiện đăng ký ↔ kiện của chuyến (LM-104). Đơn gán vào điểm giao sinh các dòng kiện `PKG-NNN`; kiện đăng ký thứ i của
 * dòng là instance thứ i (`PKG-NNN-0i`, cùng cách đặt mã của `expandPackages`). Dòng bị sửa số lượng sau khi gán thì mất liên kết.
 */

/** Kiện đăng ký → mã instance trong chuyến của đơn. */
export function assignmentInstances(order: Pick<TransportOrder, 'assignment'>, trip: Pick<Trip, 'packages'> | undefined): Map<string, string> {
  const instances = new Map<string, string>()
  if (!order.assignment || !trip) return instances
  for (const line of order.assignment.lines) {
    const tripLine = trip.packages.find((pkg) => pkg.id === line.lineId)
    if (tripLine?.quantity !== line.packageIds.length) continue
    const width = Math.max(2, String(tripLine.quantity).length)
    line.packageIds.forEach((packageId, index) => instances.set(packageId, `${line.lineId}-${String(index + 1).padStart(width, '0')}`))
  }
  return instances
}

/** Đơn đã gán mà chuyến đã hoàn thành là đã giao. */
export function effectiveOrderStatus(order: Pick<TransportOrder, 'status'>, trip: Pick<Trip, 'phase'> | undefined): OrderStatus {
  return order.status === 'assigned' && trip?.phase === 'completed' ? 'delivered' : order.status
}

/** `planned` → `loaded` khi kho đã xếp instance tương ứng, → `delivered` khi tài xế đã dỡ nó. */
export function effectivePackageStatus(
  pkg: Pick<RegisteredPackage, 'id' | 'status'>,
  order: Pick<TransportOrder, 'assignment'> | undefined,
  trip: Pick<Trip, 'packages' | 'loading' | 'delivery'> | undefined,
): RegisteredPackageStatus {
  if (pkg.status !== 'planned' || !order || !trip) return pkg.status
  const instance = assignmentInstances(order, trip).get(pkg.id)
  if (instance === undefined) return pkg.status
  if (trip.delivery?.stops.some((stop) => stop.unloadedIds.includes(instance))) return 'delivered'
  if (trip.loading?.steps.some((step) => step.packageInstanceId === instance && step.outcome === 'loaded')) return 'loaded'
  return pkg.status
}

/**
 * Nhãn QR của mọi instance trong chuyến: kiện nối từ đơn hàng dùng mã QR của kiện đăng ký (nhãn nhà sản xuất đã in); kiện nhập tay
 * dùng mã băm tất định theo chuyến + instance.
 */
export function tripLabels(
  trip: Pick<Trip, 'id' | 'packages'>,
  orders: Iterable<TransportOrder>,
  registered: ReadonlyMap<string, Pick<RegisteredPackage, 'qrToken'>>,
): TripLabel[] {
  const linked = new Map<string, string>()
  for (const order of orders) {
    if (order.assignment?.tripId !== trip.id) continue
    for (const [packageId, instanceId] of assignmentInstances(order, trip)) linked.set(instanceId, packageId)
  }
  const lineById = new Map(trip.packages.map((pkg) => [pkg.id, pkg]))
  const { instances, packageIdByInstanceId } = expandPackages(trip.packages)
  return instances.map(({ packageInstanceId, deliveryStop }) => {
    const packageId = packageIdByInstanceId.get(packageInstanceId) ?? ''
    const registeredPackageId = linked.get(packageInstanceId)
    const token = registeredPackageId === undefined ? undefined : registered.get(registeredPackageId)?.qrToken
    return {
      packageInstanceId,
      packageId,
      name: lineById.get(packageId)?.name ?? packageId,
      deliveryStop,
      qrToken: token ?? hashedQrToken(`${trip.id}/${packageInstanceId}`, LABEL_SALT),
      ...(registeredPackageId === undefined ? {} : { registeredPackageId }),
    }
  })
}

/** Nhãn khớp mã quét (so sau khi chuẩn hoá). */
export function labelByToken(labels: readonly TripLabel[], token: string): TripLabel | undefined {
  const wanted = normalizeQrToken(token)
  return labels.find((label) => label.qrToken === wanted)
}
