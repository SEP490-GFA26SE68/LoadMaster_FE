import { nextPackageId } from '@/domain/cargo'
import type { CargoPackage } from '@/domain/models'
import { found, nextId, optionalText, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { movePackage } from './db-packages'
import { MockDbError } from './errors'
import type { Package } from './package-model'
import { cargoFromPackage } from './package-type-cargo'
import { effectiveOrderStatus } from './review1-status'
import type { OrderChanges, OrderInput, TransportOrder } from './source-types'
import type { Trip } from './types'

type OrderMethods = Pick<Review1Db, 'listOrders' | 'getOrder' | 'createOrder' | 'updateOrder' | 'cancelOrder' | 'assignOrder' | 'unassignOrder'>

function assertStatus(order: TransportOrder, status: TransportOrder['status']) {
  if (order.status !== status) throw new MockDbError('ORDER_STATUS_INVALID', { orderId: order.id, status: order.status })
}

/** Trường chữ của đơn: bỏ khoảng trắng hai đầu, trường tuỳ chọn để trống thì bỏ hẳn. */
function orderText(input: OrderChanges, current?: TransportOrder) {
  const pick = (key: 'contactName' | 'phone' | 'note') => (input[key] === undefined ? current?.[key] : optionalText(input[key]))
  const contactName = pick('contactName')
  const phone = pick('phone')
  const note = pick('note')
  return {
    customerName: input.customerName?.trim() ?? current?.customerName ?? '',
    deliveryAddress: input.deliveryAddress?.trim() ?? current?.deliveryAddress ?? '',
    ...(contactName === undefined ? {} : { contactName }),
    ...(phone === undefined ? {} : { phone }),
    ...(note === undefined ? {} : { note }),
  }
}

/**
 * Đơn vận chuyển và gán vào điểm giao (luồng 2, LM-104). Đơn, kiện của đơn và chuyến nhận đơn cùng một công ty (D-64). Gán đơn đưa kiện
 * sang `ASSIGNED` kèm chuyến và điểm giao; bỏ gán trả kiện về `IMPORTED` (FE-3b-01).
 */
export function orderMethods(ctx: DbContext): OrderMethods {
  const { orders, packages, trips, packageTypes } = ctx.state
  const scope = ctx.scope.orders

  /** Kiện có cờ không vào đơn hay chuyến được cho tới khi gỡ cờ (D-92). */
  function assertNoFlag(pkg: Package) {
    const flag = pkg.flags[0]
    if (flag !== undefined) throw new MockDbError('PACKAGE_FLAGGED', { packageId: pkg.id, flag })
  }

  function withStatus(order: TransportOrder): TransportOrder {
    const trip = order.assignment ? trips.get(order.assignment.tripId) : undefined
    const status = effectiveOrderStatus(order, trip)
    return status === order.status ? order : { ...order, status }
  }

  /** Kiện của đơn `orderId` (công ty `companyId`): cùng công ty với đơn, còn ở kho kiện (`IMPORTED`), không cờ, chưa thuộc đơn khác. */
  function assertPackages(packageIds: readonly string[], orderId: string, companyId: string) {
    if (packageIds.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
    for (const id of packageIds) {
      const pkg = ctx.scope.packages.ref(id, companyId)
      assertNoFlag(pkg)
      const taken = pkg.orderId !== undefined && pkg.orderId !== orderId
      if (pkg.status !== 'IMPORTED' || taken) throw new MockDbError('PACKAGE_UNAVAILABLE', { packageId: id, status: pkg.status })
    }
  }

  function linkPackages(orderId: string, before: readonly string[], after: readonly string[]) {
    for (const id of before) {
      const pkg = packages.get(id)
      if (pkg && !after.includes(id)) {
        const { orderId: _dropped, ...rest } = pkg
        put(packages, rest)
      }
    }
    for (const id of after) {
      const pkg = packages.get(id)
      if (pkg) put(packages, { ...pkg, orderId })
    }
  }

  /**
   * Kiện của đơn thành dòng kiện mới của chuyến, theo thứ tự kiện trong đơn: các kiện cùng loại kiện, cùng kích thước, khối lượng và
   * loại hàng gộp một dòng; kiện không có loại kiện mỗi kiện một dòng (tên dòng là mã kiện của bên gửi).
   */
  function orderLines(order: TransportOrder, trip: Trip, stopNumber: number) {
    const groups = new Map<string, Package[]>()
    for (const id of order.packageIds) {
      const pkg = found(packages, 'packages', id)
      const key = pkg.packageTypeId === undefined
        ? pkg.id
        : [pkg.packageTypeId, pkg.lengthCm, pkg.widthCm, pkg.heightCm, pkg.weightKg, pkg.handlingClass].join('|')
      groups.set(key, [...(groups.get(key) ?? []), pkg])
    }
    const ids = trip.packages.map((pkg) => pkg.id)
    const cargo: CargoPackage[] = []
    const lines: { lineId: string; packageIds: string[] }[] = []
    for (const members of groups.values()) {
      const first = members[0]
      if (!first) continue
      const lineId = nextPackageId(ids)
      ids.push(lineId)
      const type = first.packageTypeId === undefined ? undefined : found(packageTypes, 'packageTypes', first.packageTypeId)
      cargo.push(cargoFromPackage(first, type, { id: lineId, quantity: members.length, deliveryStop: stopNumber, groupId: order.id }))
      lines.push({ lineId, packageIds: members.map((pkg) => pkg.id) })
    }
    return { cargo, lines }
  }

  return {
    listOrders: () => ctx.respond(() => scope.list().map(withStatus).toReversed()),
    getOrder: (id) => ctx.respond(() => withStatus(scope.read(id))),
    createOrder: (input: OrderInput) =>
      ctx.respond(() => {
        const companyId = ctx.scope.newRecordCompany()
        const id = nextId('ORD', orders.keys())
        const packageIds = [...new Set(input.packageIds)]
        assertPackages(packageIds, id, companyId)
        const order = put(orders, { id, companyId, ...orderText(input), packageIds, status: 'pending', createdAt: ctx.nowIso(), createdBy: ctx.state.session.userId })
        linkPackages(id, [], packageIds)
        ctx.log('order.created', { type: 'order', id }, { customerName: order.customerName, count: packageIds.length })
        return order
      }),
    updateOrder: (id, changes) =>
      ctx.respond(() => {
        const current = scope.own(id)
        assertStatus(current, 'pending')
        const packageIds = changes.packageIds === undefined ? current.packageIds : [...new Set(changes.packageIds)]
        if (changes.packageIds !== undefined) assertPackages(packageIds, id, current.companyId)
        const { contactName: _c, phone: _p, note: _n, ...rest } = current
        const next: TransportOrder = { ...rest, ...orderText(changes, current), packageIds }
        linkPackages(id, current.packageIds, packageIds)
        ctx.log('order.updated', { type: 'order', id }, { customerName: next.customerName, count: packageIds.length })
        return put(orders, next)
      }),
    cancelOrder: (id, reason) =>
      ctx.respond(() => {
        const current = scope.own(id)
        assertStatus(current, 'pending')
        const trimmed = reason.trim()
        if (trimmed === '') throw new MockDbError('REASON_REQUIRED', {})
        linkPackages(id, current.packageIds, [])
        ctx.log('order.cancelled', { type: 'order', id }, { reason: trimmed })
        return put(orders, { ...current, status: 'cancelled', cancellation: { at: ctx.nowIso(), by: ctx.state.session.userId, reason: trimmed } })
      }),
    assignOrder: (orderId, tripId, stopId) =>
      ctx.respond(() => {
        const order = scope.own(orderId)
        assertStatus(order, 'pending')
        const trip = ctx.scope.trips.ref(tripId, order.companyId)
        if (trip.phase !== 'planning') throw new MockDbError('TRIP_LOCKED', { tripId, phase: trip.phase })
        const stopIndex = trip.stops.findIndex((stop) => stop.id === stopId)
        if (stopIndex === -1) throw new MockDbError('STOP_NOT_FOUND', { tripId, stopId })
        const members = order.packageIds.map((id) => found(packages, 'packages', id))
        members.forEach(assertNoFlag)
        const { cargo, lines } = orderLines(order, trip, stopIndex + 1)
        const nextTrip = put(trips, { ...trip, packages: [...trip.packages, ...cargo], inputVersion: trip.inputVersion + 1 })
        for (const pkg of members) movePackage(ctx, pkg, 'ASSIGNED', { tripId, stopId })
        const assignment = { tripId, stopId, lines, at: ctx.nowIso(), by: ctx.state.session.userId }
        ctx.log('order.assigned', { type: 'order', id: orderId }, { tripId, stopNumber: stopIndex + 1, count: order.packageIds.length })
        return { order: put(orders, { ...order, status: 'assigned', assignment }), trip: nextTrip }
      }),
    unassignOrder: (orderId) =>
      ctx.respond(() => {
        const order = scope.own(orderId)
        assertStatus(order, 'assigned')
        const assignment = order.assignment
        const trip = assignment ? found(trips, 'trips', assignment.tripId) : undefined
        if (trip && trip.phase !== 'planning' && trip.phase !== 'cancelled') throw new MockDbError('TRIP_LOCKED', { tripId: trip.id, phase: trip.phase })
        if (trip && assignment && trip.phase === 'planning') {
          const lineIds = new Set(assignment.lines.map((line) => line.lineId))
          put(trips, { ...trip, packages: trip.packages.filter((pkg) => !lineIds.has(pkg.id)), inputVersion: trip.inputVersion + 1 })
        }
        // Chuyến đã huỷ thì kiện đã về kho kiện lúc huỷ (`releaseTripPackages`)
        for (const id of order.packageIds) {
          const pkg = found(packages, 'packages', id)
          if (pkg.status !== 'IMPORTED') movePackage(ctx, pkg, 'IMPORTED')
        }
        const { assignment: _dropped, ...rest } = order
        ctx.log('order.unassigned', { type: 'order', id: orderId }, { tripId: assignment?.tripId ?? '' })
        return put(orders, { ...rest, status: 'pending' })
      }),
  }
}
