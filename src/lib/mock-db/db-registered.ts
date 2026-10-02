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
function withEffectiveStatus(state: DbState, pkg: RegisteredPackage): RegisteredPackage {
  const order = pkg.orderId === undefined ? undefined : state.orders.get(pkg.orderId)
  const trip = order?.assignment ? state.trips.get(order.assignment.tripId) : undefined
  const status = effectivePackageStatus(pkg, order, trip)
  return status === pkg.status ? pkg : { ...pkg, status }
}

/**
 * Công ty nhận kiện đăng ký mới: công ty của người đang đăng nhập (FE-0-06, D-63 — khách hàng của app là công ty logistics, không còn
 * nhà sản xuất đăng ký hộ). Phiên không thuộc công ty nào (chưa đăng nhập, tài khoản nền tảng) thì không đăng ký được.
 */
function sessionCompany(state: DbState): string {
  const companyId = sessionUserOf(state)?.companyId
  if (companyId === undefined) throw new MockDbError('COMPANY_REQUIRED', {})
  return companyId
}

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_REGISTER_QUANTITY) {
    throw new MockDbError('QUANTITY_INVALID', { min: 1, max: MAX_REGISTER_QUANTITY })
  }
}

/**
 * Kiện đăng ký (LM-104): tạo một / theo số lượng / nhiều dòng; mỗi kiện một mã QR ngẫu nhiên. Hàm đọc trả mọi kiện — lọc theo công ty
 * của phiên là việc của FE-0-02.
 */
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
    const owner = sessionCompany(state)
    if (rows.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
    // Kiểm hết trước khi ghi: một dòng sai thì không dòng nào được ghi
    for (const row of rows) {
      found(packageTypes, 'packageTypes', row.packageTypeId)
      assertQuantity(row.quantity)
    }
    const created = rows.flatMap((row) => create(row, owner, row.quantity))
    const types = [...new Set(rows.map((row) => row.packageTypeId))]
    ctx.log('package.registered', { type: 'package', id: created[0]?.id ?? '' }, {
      count: created.length,
      packageTypeId: types.join(','),
      ...(created.length > 1 ? { lastPackageId: created.at(-1)?.id ?? '' } : {}),
    })
    return created
  }

  return {
    listRegisteredPackages: () => ctx.respond(() => [...registeredPackages.values()].map((pkg) => withEffectiveStatus(state, pkg))),
    getRegisteredPackage: (id) => ctx.respond(() => withEffectiveStatus(state, found(registeredPackages, 'registeredPackages', id))),
    findPackageByQr: (token) =>
      ctx.respond(() => {
        const wanted = normalizeQrToken(token)
        const pkg = [...registeredPackages.values()].find((item) => item.qrToken === wanted)
        if (!pkg) throw new MockDbError('QR_UNKNOWN', { token: wanted })
        return withEffectiveStatus(state, pkg)
      }),
    registerPackage: (input) => ctx.respond(() => register([{ ...input, quantity: 1 }])[0] as RegisteredPackage),
    registerPackages: (input, quantity) => ctx.respond(() => register([{ ...input, quantity }])),
    registerPackageRows: (rows) => ctx.respond(() => register(rows)),
  }
}
