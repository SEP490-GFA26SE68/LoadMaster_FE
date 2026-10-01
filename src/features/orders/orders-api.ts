import { roundKg } from '@/domain/geometry'
import {
  getMockDb,
  type DeliveryStop,
  type OrderChanges,
  type OrderInput,
  type PackageType,
  type RegisteredPackage,
  type TransportOrder,
  type Trip,
} from '@/lib/mock-db'

/**
 * Lớp dữ liệu đơn hàng (luồng 2 Review 1, LM-104): đơn từ kiện đã nhận ở kho của công ty, gán vào điểm giao của chuyến đang lập kế
 * hoạch. Gán đơn thêm dòng kiện vào chuyến nên chuyến và revision cũng đổi (lỗi thời, D-31).
 */

export type OrderPackage = { readonly package: RegisteredPackage; readonly type: PackageType | undefined }

/** Một đơn kèm kiện (có loại kiện), tổng khối lượng và chuyến được gán. */
export type OrderRow = {
  readonly order: TransportOrder
  readonly packages: readonly OrderPackage[]
  readonly totalKg: number
  readonly trip: Pick<Trip, 'id' | 'name' | 'scheduledDate'> | undefined
  /** Số điểm giao (1-based) của điểm được gán; vắng khi chưa gán hoặc điểm không còn. */
  readonly stopNumber: number | undefined
}

async function orderContext() {
  const db = getMockDb()
  const [packages, types, trips] = await Promise.all([db.listRegisteredPackages(), db.listPackageTypes(), db.listTrips()])
  return {
    packageById: new Map(packages.map((pkg) => [pkg.id, pkg])),
    typeById: new Map(types.map((type) => [type.id, type])),
    tripById: new Map(trips.map((trip) => [trip.id, trip])),
  }
}

function toRow(order: TransportOrder, context: Awaited<ReturnType<typeof orderContext>>): OrderRow {
  const packages = order.packageIds.flatMap((id) => {
    const pkg = context.packageById.get(id)
    return pkg ? [{ package: pkg, type: context.typeById.get(pkg.packageTypeId) }] : []
  })
  const trip = order.assignment ? context.tripById.get(order.assignment.tripId) : undefined
  const stopIndex = trip && order.assignment ? trip.stops.findIndex((stop) => stop.id === order.assignment?.stopId) : -1
  return {
    order,
    packages,
    totalKg: roundKg(packages.reduce((sum, item) => sum + (item.type?.weightKg ?? 0), 0)),
    trip: trip ? { id: trip.id, name: trip.name, scheduledDate: trip.scheduledDate } : undefined,
    stopNumber: stopIndex === -1 ? undefined : stopIndex + 1,
  }
}

export async function fetchOrders(): Promise<OrderRow[]> {
  const [orders, context] = await Promise.all([getMockDb().listOrders(), orderContext()])
  return orders.map((order) => toRow(order, context))
}

export async function fetchOrder(id: string): Promise<OrderRow> {
  const [order, context] = await Promise.all([getMockDb().getOrder(id), orderContext()])
  return toRow(order, context)
}

/** Kiện chọn được cho đơn mới: đã nhận ở kho (`received`), chưa thuộc đơn nào. */
export async function fetchOrderablePackages(): Promise<OrderPackage[]> {
  const context = await orderContext()
  return [...context.packageById.values()]
    .filter((pkg) => pkg.status === 'received' && pkg.orderId === undefined)
    .map((pkg) => ({ package: pkg, type: context.typeById.get(pkg.packageTypeId) }))
}

/** Chuyến nhận được đơn: đang lập kế hoạch (kho chưa xếp), kèm điểm giao để chọn. */
export type AssignableTrip = Pick<Trip, 'id' | 'name' | 'scheduledDate' | 'vehicleId'> & { readonly stops: readonly DeliveryStop[] }

export async function fetchAssignableTrips(): Promise<AssignableTrip[]> {
  const trips = await getMockDb().listTrips()
  return trips
    .filter((trip) => trip.phase === 'planning')
    .map(({ id, name, scheduledDate, vehicleId, stops }) => ({ id, name, scheduledDate, vehicleId, stops }))
}

export function createOrder(input: OrderInput): Promise<TransportOrder> {
  return getMockDb().createOrder(input)
}

export function updateOrder(id: string, changes: OrderChanges): Promise<TransportOrder> {
  return getMockDb().updateOrder(id, changes)
}

export function cancelOrder(id: string, reason: string): Promise<TransportOrder> {
  return getMockDb().cancelOrder(id, reason)
}

export type AssignOrderInput = { readonly orderId: string; readonly tripId: string; readonly stopId: string }

export function assignOrder({ orderId, tripId, stopId }: AssignOrderInput): Promise<{ order: TransportOrder; trip: Trip }> {
  return getMockDb().assignOrder(orderId, tripId, stopId)
}

export function unassignOrder(orderId: string): Promise<TransportOrder> {
  return getMockDb().unassignOrder(orderId)
}
