import { found, nextId, optionalText, put, sessionUserOf, type DbContext, type DbState } from './db-context'
import type { Review1Db } from './db-api-review1'
import { withEffectiveStatus, manufacturerFor } from './db-registered'
import { MockDbError } from './errors'
import { normalizeQrToken } from './qr-token'
import type { Shipment, ShipmentChanges } from './source-types'

type ShipmentMethods = Pick<
  Review1Db,
  'listShipments' | 'getShipment' | 'createShipment' | 'updateShipment' | 'deleteShipment' | 'handOverShipment' | 'receivePackageByQr'
>

/** Lô người đang đăng nhập được thấy: nhà sản xuất — lô của mình; logistics — lô đã bàn giao cho công ty mình. */
function visibleShipment(state: DbState, shipment: Shipment): boolean {
  const user = sessionUserOf(state)
  if (user?.role === 'manufacturer') return shipment.manufacturerId === user.companyId
  if (user?.role === 'logistics') return shipment.status !== 'draft' && shipment.logisticsCompanyId === user.companyId
  return true
}

function assertDraft(shipment: Shipment) {
  if (shipment.status !== 'draft') throw new MockDbError('SHIPMENT_STATUS_INVALID', { shipmentId: shipment.id, status: shipment.status })
}

/** Lô hàng và nhận hàng (luồng 1, LM-104). */
export function shipmentMethods(ctx: DbContext): ShipmentMethods {
  const { state } = ctx
  const { shipments, registeredPackages, companies } = state

  function assertLogistics(companyId: string) {
    if (found(companies, 'companies', companyId).kind !== 'logistics') throw new MockDbError('COMPANY_KIND_INVALID', { companyId })
  }

  /** Kiện đưa vào lô `shipmentId`: thuộc nhà sản xuất của lô, còn `registered`, chưa ở lô khác. */
  function assertPackages(packageIds: readonly string[], manufacturerId: string, shipmentId: string | undefined) {
    if (packageIds.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
    for (const id of new Set(packageIds)) {
      const pkg = found(registeredPackages, 'registeredPackages', id)
      if (pkg.ownerCompanyId !== manufacturerId) throw new MockDbError('PACKAGE_NOT_OWNED', { packageId: id })
      const elsewhere = pkg.shipmentId !== undefined && pkg.shipmentId !== shipmentId
      if (pkg.status !== 'registered' || elsewhere) throw new MockDbError('PACKAGE_UNAVAILABLE', { packageId: id, status: pkg.status })
    }
  }

  /** Gắn / gỡ mã lô trên kiện theo danh sách mới của lô. */
  function relink(shipmentId: string, before: readonly string[], after: readonly string[]) {
    for (const id of before) {
      const pkg = registeredPackages.get(id)
      if (pkg && !after.includes(id)) {
        const { shipmentId: _dropped, ...rest } = pkg
        put(registeredPackages, rest)
      }
    }
    for (const id of after) {
      const pkg = registeredPackages.get(id)
      if (pkg) put(registeredPackages, { ...pkg, shipmentId })
    }
  }

  return {
    listShipments: () => ctx.respond(() => [...shipments.values()].filter((shipment) => visibleShipment(state, shipment)).toReversed()),
    getShipment: (id) =>
      ctx.respond(() => {
        const shipment = found(shipments, 'shipments', id)
        if (!visibleShipment(state, shipment)) throw new MockDbError('NOT_FOUND', { collection: 'shipments', id })
        return shipment
      }),
    createShipment: ({ logisticsCompanyId, packageIds, note, manufacturerId }) =>
      ctx.respond(() => {
        const manufacturer = manufacturerFor(state, manufacturerId)
        assertLogistics(logisticsCompanyId)
        const ids = [...new Set(packageIds)]
        const id = nextId('SHP', shipments.keys())
        assertPackages(ids, manufacturer, id)
        const trimmed = optionalText(note)
        const shipment = put(shipments, {
          id, manufacturerId: manufacturer, logisticsCompanyId, packageIds: ids, status: 'draft',
          ...(trimmed === undefined ? {} : { note: trimmed }),
          createdAt: ctx.nowIso(), createdBy: state.session.userId, receipts: [],
        })
        relink(id, [], ids)
        ctx.log('shipment.created', { type: 'shipment', id }, { count: ids.length, logisticsCompanyId })
        return shipment
      }),
    updateShipment: (id, changes: ShipmentChanges) =>
      ctx.respond(() => {
        const current = found(shipments, 'shipments', id)
        assertDraft(current)
        if (changes.logisticsCompanyId !== undefined) assertLogistics(changes.logisticsCompanyId)
        const ids = changes.packageIds === undefined ? current.packageIds : [...new Set(changes.packageIds)]
        if (changes.packageIds !== undefined) assertPackages(ids, current.manufacturerId, id)
        const note = changes.note === undefined ? current.note : optionalText(changes.note)
        const { note: _old, ...rest } = current
        const next: Shipment = {
          ...rest, packageIds: ids, logisticsCompanyId: changes.logisticsCompanyId ?? current.logisticsCompanyId,
          ...(note === undefined ? {} : { note }),
        }
        relink(id, current.packageIds, ids)
        ctx.log('shipment.updated', { type: 'shipment', id }, { count: ids.length, logisticsCompanyId: next.logisticsCompanyId })
        return put(shipments, next)
      }),
    deleteShipment: (id) =>
      ctx.respond(() => {
        const current = found(shipments, 'shipments', id)
        assertDraft(current)
        relink(id, current.packageIds, [])
        shipments.delete(id)
        ctx.log('shipment.deleted', { type: 'shipment', id }, { count: current.packageIds.length })
      }),
    handOverShipment: (id) =>
      ctx.respond(() => {
        const current = found(shipments, 'shipments', id)
        assertDraft(current)
        for (const packageId of current.packageIds) {
          const pkg = found(registeredPackages, 'registeredPackages', packageId)
          put(registeredPackages, { ...pkg, status: 'in_shipment' })
        }
        ctx.log('shipment.handedOver', { type: 'shipment', id }, { count: current.packageIds.length, logisticsCompanyId: current.logisticsCompanyId })
        return put(shipments, { ...current, status: 'handed_over', handedOverAt: ctx.nowIso(), handedOverBy: state.session.userId })
      }),
    receivePackageByQr: (token) =>
      ctx.respond(() => {
        const wanted = normalizeQrToken(token)
        const pkg = [...registeredPackages.values()].find((item) => item.qrToken === wanted)
        const shipment = pkg?.shipmentId === undefined ? undefined : shipments.get(pkg.shipmentId)
        if (!pkg || !shipment || shipment.status === 'draft') throw new MockDbError('QR_UNKNOWN', { token: wanted })
        const user = sessionUserOf(state)
        // Quản trị hệ thống không còn quyền vận hành (FE-0-01): chỉ logistics của công ty được giao lô mới nhận
        const allowed = user === undefined || (user.role === 'logistics' && user.companyId === shipment.logisticsCompanyId)
        if (!allowed) throw new MockDbError('RECEIVING_FORBIDDEN', { shipmentId: shipment.id })
        if (pkg.status !== 'in_shipment') throw new MockDbError('PACKAGE_ALREADY_RECEIVED', { packageId: pkg.id })
        const at = ctx.nowIso()
        const received = put(registeredPackages, { ...pkg, status: 'received', received: { at, by: state.session.userId } })
        const receipts = [...shipment.receipts, { packageId: pkg.id, at, by: state.session.userId }]
        const status = receipts.length >= shipment.packageIds.length ? 'received' : 'partially_received'
        ctx.log('shipment.packageReceived', { type: 'shipment', id: shipment.id }, { packageId: pkg.id, received: receipts.length, count: shipment.packageIds.length })
        return { package: withEffectiveStatus(state, received), shipment: put(shipments, { ...shipment, receipts, status }) }
      }),
  }
}
