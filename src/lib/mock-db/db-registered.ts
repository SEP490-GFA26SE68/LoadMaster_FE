import { found, nextId, optionalText, put, sessionUserOf, type DbContext, type DbState } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import { normalizeQrToken } from './qr-token'
import { effectivePackageStatus } from './review1-status'
import type { RegisteredPackage, RegisteredPackageInput, RegisteredPackageRow } from './source-types'

type RegisteredMethods = Pick<
  Review1Db,
  'listRegisteredPackages' | 'getRegisteredPackage' | 'findPackageByQr' | 'registerPackage' | 'registerPackages' | 'registerPackageRows'
>

/** Giới hạn một lần đăng ký theo số lượng (một dòng nhập file cũng vậy). */
export const MAX_REGISTER_QUANTITY = 500

/** Trạng thái hiện của kiện: `loaded` / `delivered` suy từ chuyến của đơn (LM-104). */
export function withEffectiveStatus(state: DbState, pkg: RegisteredPackage): RegisteredPackage {
  const order = pkg.orderId === undefined ? undefined : state.orders.get(pkg.orderId)
  const trip = order?.assignment ? state.trips.get(order.assignment.tripId) : undefined
  const status = effectivePackageStatus(pkg, order, trip)
  return status === pkg.status ? pkg : { ...pkg, status }
}

/** Kiện người đang đăng nhập được thấy — như server lọc theo công ty. Không có phiên (test logic kho) thì thấy hết. */
export function visibleToSession(state: DbState, pkg: RegisteredPackage): boolean {
  const user = sessionUserOf(state)
  if (user?.role === 'manufacturer') return pkg.ownerCompanyId === user.companyId
  if (user?.role === 'logistics') {
    const shipment = pkg.shipmentId === undefined ? undefined : state.shipments.get(pkg.shipmentId)
    return shipment !== undefined && shipment.status !== 'draft' && shipment.logisticsCompanyId === user.companyId
  }
  return true
}

/**
 * Nhà sản xuất của thao tác: nhà sản xuất đăng nhập luôn làm cho công ty mình; người khác (quản trị viên, test không phiên) phải chỉ
 * rõ công ty, và công ty đó phải là nhà sản xuất.
 */
export function manufacturerFor(state: DbState, requested: string | undefined): string {
  const user = sessionUserOf(state)
  if (user?.role === 'manufacturer') {
    if (user.companyId === undefined) throw new MockDbError('COMPANY_REQUIRED', {})
    return user.companyId
  }
  if (requested === undefined) throw new MockDbError('COMPANY_REQUIRED', {})
  if (found(state.companies, 'companies', requested).kind !== 'manufacturer') throw new MockDbError('COMPANY_KIND_INVALID', { companyId: requested })
  return requested
}

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_REGISTER_QUANTITY) {
    throw new MockDbError('QUANTITY_INVALID', { min: 1, max: MAX_REGISTER_QUANTITY })
  }
}

/** Kiện đăng ký (luồng 1, LM-104): tạo một / theo số lượng / nhiều dòng; mỗi kiện một mã QR ngẫu nhiên. */
export function registeredMethods(ctx: DbContext): RegisteredMethods {
  const { state } = ctx
  const { registeredPackages, packageTypes } = state

  /** Ghi `quantity` kiện của một dòng; nơi gọi đã kiểm dòng. */
  function create(input: RegisteredPackageInput, owner: string, quantity: number): RegisteredPackage[] {
    const at = ctx.nowIso()
    const reference = optionalText(input.reference)
    const note = optionalText(input.note)
    return Array.from({ length: quantity }, () => put(registeredPackages, {
      id: nextId('RPK', registeredPackages.keys(), 4),
      packageTypeId: input.packageTypeId,
      ownerCompanyId: owner,
      qrToken: ctx.newQrToken(),
      status: 'registered',
      ...(reference === undefined ? {} : { reference }),
      ...(note === undefined ? {} : { note }),
      registeredAt: at,
      registeredBy: state.session.userId,
    }))
  }

  function register(rows: readonly RegisteredPackageRow[]): RegisteredPackage[] {
    if (rows.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
    // Kiểm hết trước khi ghi: một dòng sai thì không dòng nào được ghi
    const checked = rows.map((row) => {
      found(packageTypes, 'packageTypes', row.packageTypeId)
      assertQuantity(row.quantity)
      return { row, owner: manufacturerFor(state, row.ownerCompanyId) }
    })
    const created = checked.flatMap(({ row, owner }) => create(row, owner, row.quantity))
    const types = [...new Set(rows.map((row) => row.packageTypeId))]
    ctx.log('package.registered', { type: 'package', id: created[0]?.id ?? '' }, {
      count: created.length,
      packageTypeId: types.join(','),
      ...(created.length > 1 ? { lastPackageId: created.at(-1)?.id ?? '' } : {}),
    })
    return created
  }

  return {
    listRegisteredPackages: () =>
      ctx.respond(() => [...registeredPackages.values()].filter((pkg) => visibleToSession(state, pkg)).map((pkg) => withEffectiveStatus(state, pkg))),
    getRegisteredPackage: (id) =>
      ctx.respond(() => {
        const pkg = found(registeredPackages, 'registeredPackages', id)
        if (!visibleToSession(state, pkg)) throw new MockDbError('NOT_FOUND', { collection: 'registeredPackages', id })
        return withEffectiveStatus(state, pkg)
      }),
    findPackageByQr: (token) =>
      ctx.respond(() => {
        const wanted = normalizeQrToken(token)
        const pkg = [...registeredPackages.values()].find((item) => item.qrToken === wanted)
        if (!pkg || !visibleToSession(state, pkg)) throw new MockDbError('QR_UNKNOWN', { token: wanted })
        return withEffectiveStatus(state, pkg)
      }),
    registerPackage: (input) => ctx.respond(() => register([{ ...input, quantity: 1 }])[0] as RegisteredPackage),
    registerPackages: (input, quantity) => ctx.respond(() => register([{ ...input, quantity }])),
    registerPackageRows: (rows) => ctx.respond(() => register(rows)),
  }
}
